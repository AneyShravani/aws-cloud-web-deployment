const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');

const Assignment = require('../models/Assignment');
const Expense = require('../models/Expense');
const Lab = require('../models/Lab');
const Organization = require('../models/Organization');
const Report = require('../models/Report');
const System = require('../models/System');
const Booking = require('../models/Booking');
const Utilization = require('../models/Utilization');
const { getStatus } = require('./referenceIdService');

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const assertValidDate = (value, label) => {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) {
    const error = new Error(`${label} is invalid.`);
    error.statusCode = 400;
    throw error;
  }
  return d;
};

const assertValidYearMonth = (year, month) => {
  const y = Number(year);
  const m = Number(month);

  if (!Number.isInteger(y) || y < 1970 || y > 9999) {
    const error = new Error('year is invalid.');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(m) || m < 1 || m > 12) {
    const error = new Error('month is invalid.');
    error.statusCode = 400;
    throw error;
  }

  return { year: y, month: m };
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

const formatDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN');
};

const buildTitle = (type, from, to) => {
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return `${label} Report (${formatDate(from)} to ${formatDate(to)})`;
};

function resolveDateRange(type, params = {}) {
  const reportType = String(type || '').toLowerCase();

  if (reportType === 'custom') {
    const from = startOfDay(assertValidDate(params.from, 'from'));
    const to = endOfDay(assertValidDate(params.to, 'to'));

    if (from > to) {
      const error = new Error('from must be before or equal to to.');
      error.statusCode = 400;
      throw error;
    }

    return { type: reportType, from, to };
  }

  if (reportType === 'monthly') {
    const { year, month } = assertValidYearMonth(params.year, params.month);
    const from = startOfDay(new Date(year, month - 1, 1));
    const to = endOfDay(new Date(year, month, 0));
    return { type: reportType, from, to, year, month };
  }

  if (reportType === 'weekly') {
    const { year, month } = assertValidYearMonth(params.year, params.month);
    const week = Number(params.week);

    if (!Number.isInteger(week) || week < 1 || week > 6) {
      const error = new Error('week is invalid.');
      error.statusCode = 400;
      throw error;
    }

    const firstOfMonth = new Date(year, month - 1, 1);
    const firstDay = firstOfMonth.getDay();
    const daysFromMonday = (firstDay + 6) % 7;
    const firstWeekMonday = new Date(year, month - 1, 1 - daysFromMonday);
    const monday = new Date(firstWeekMonday);
    monday.setDate(firstWeekMonday.getDate() + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      type: reportType,
      from: startOfDay(monday),
      to: endOfDay(sunday),
      year,
      month,
      week,
    };
  }

  const error = new Error('type must be custom, weekly, or monthly.');
  error.statusCode = 400;
  throw error;
}

const uniqueCount = (values) => new Set(values.filter(Boolean).map((v) => v.toString())).size;

const makeBreakdown = (items, pick) => {
  const counts = {};
  items.forEach((item) => {
    const key = pick(item) || 'Unknown';
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
};

const sumField = (items, field) => items.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);

async function buildReportSnapshot(orgId, range, generatedBy) {
  const { type, from, to } = range;
  const organization = await Organization.findById(orgId).select('name').lean();

  const [labs, systems, assignments, utilizations, periodExpenses, cumulativeExpenses, periodBookings] = await Promise.all([
    Lab.find({ orgId }).lean(),
    System.find({ orgId }).lean(),
    Assignment.find({
      orgId,
      startDate: { $lte: to },
      endDate: { $gte: from },
    })
      .populate('labUserId', 'name rollNumber department userType')
      .lean(),
    Utilization.find({
      orgId,
      createdAt: { $gte: from, $lte: to },
    })
      .populate('labUserId', 'name rollNumber department userType')
      .lean(),
    Expense.find({ orgId, createdAt: { $gte: from, $lte: to } }).lean(),
    Expense.find({ orgId }).lean(),
    // v2 slot-booking: real machine/lab usage lives on Booking, NOT on
    // Assignment.systemId (which is now the approval umbrella, no machine).
    Booking.find({ orgId, date: { $gte: from, $lte: to }, status: { $ne: 'CANCELLED' } })
      .select('systemId labId assignmentId labUserId')
      .lean(),
  ]);

  const labById = new Map(labs.map((lab) => [lab._id.toString(), lab]));
  const systemNameById = new Map(systems.map((s) => [s._id.toString(), s.name]));
  const systemsByLab = new Map();
  systems.forEach((system) => {
    const labId = system.labId?.toString();
    if (!systemsByLab.has(labId)) systemsByLab.set(labId, []);
    systemsByLab.get(labId).push(system);
  });

  // ---- derive lab/system activity from bookings (the slot model) ----
  const usedSystemIds = new Set();               // distinct systems booked in the period
  const bookingLabIds = new Set();               // labs with any booking in the period
  const systemsBookedByLab = new Map();          // labId -> Set(systemId)
  const assignmentsBookedByLab = new Map();      // labId -> Set(assignmentId)
  const labIdsByLabUser = new Map();             // labUserId -> Set(labId)
  const bookingStatsByAssignment = new Map();    // assignmentId -> { systems:Set(name), labs:Set(name) }

  const addToSetMap = (map, key, value) => {
    if (!key || !value) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  };

  periodBookings.forEach((b) => {
    const systemId = b.systemId?.toString();
    const labId = b.labId?.toString();
    const assignmentId = b.assignmentId?.toString();
    const labUserId = b.labUserId?.toString();

    if (systemId) usedSystemIds.add(systemId);
    if (labId) bookingLabIds.add(labId);
    addToSetMap(systemsBookedByLab, labId, systemId);
    addToSetMap(assignmentsBookedByLab, labId, assignmentId);
    addToSetMap(labIdsByLabUser, labUserId, labId);

    if (assignmentId) {
      if (!bookingStatsByAssignment.has(assignmentId)) {
        bookingStatsByAssignment.set(assignmentId, { systems: new Set(), labs: new Set() });
      }
      const stat = bookingStatsByAssignment.get(assignmentId);
      const sysName = systemId ? systemNameById.get(systemId) : null;
      const labName = labId ? labById.get(labId)?.name : null;
      if (sysName) stat.systems.add(sysName);
      if (labName) stat.labs.add(labName);
    }
  });

  // "labs with activity" = booked in the period, OR had utilization by a user who booked
  const activityLabIdSet = new Set(bookingLabIds);
  utilizations.forEach((u) => {
    const labUserId = (u.labUserId?._id || u.labUserId)?.toString();
    const labIds = labIdsByLabUser.get(labUserId);
    if (labIds) labIds.forEach((labId) => activityLabIdSet.add(labId));
  });
  const activityLabIds = Array.from(activityLabIdSet);

  const assignmentRows = assignments.map((assignment) => {
    const status = getStatus(assignment);
    const stat = bookingStatsByAssignment.get(assignment._id.toString());
    return {
      id: assignment._id.toString(),
      referenceId: assignment.referenceId,
      student: assignment.labUserId?.name || '-',
      rollNumber: assignment.labUserId?.rollNumber || '-',
      department: assignment.labUserId?.department || '-',
      userType: assignment.labUserId?.userType || '-',
      // v2: an approval spans many machines/labs via bookings — show what was actually used
      system: stat && stat.systems.size ? Array.from(stat.systems).join(', ') : '-',
      lab: stat && stat.labs.size ? Array.from(stat.labs).join(', ') : '-',
      project: assignment.projectName,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      status,
    };
  });

  const assignmentStatusCounts = assignmentRows.reduce(
    (acc, item) => {
      if (item.status === 'ACTIVE') acc.active += 1;
      if (item.status === 'NEARING_EXPIRY') acc.nearingExpiry += 1;
      if (item.status === 'EXPIRED') acc.expired += 1;
      return acc;
    },
    { active: 0, nearingExpiry: 0, expired: 0 }
  );

  const projectRows = utilizations.map((u) => ({
    id: u._id.toString(),
    student: u.labUserId?.name || '-',
    department: u.labUserId?.department || '-',
    userType: u.labUserId?.userType || '-',
    toolName: u.toolName,
    projectName: u.projectName,
    status: u.status,
    deployment: u.isActive ? 'active' : 'inactive',
    liveUrl: u.liveUrl || '',
    createdAt: u.createdAt,
  }));

  const projectCounts = projectRows.reduce(
    (acc, project) => {
      if (project.status === 'done') acc.doneCount += 1;
      if (project.status === 'not_done') acc.notDoneCount += 1;
      if (project.deployment === 'active') acc.activeDeploymentCount += 1;
      if (project.deployment === 'inactive') acc.inactiveDeploymentCount += 1;
      return acc;
    },
    { doneCount: 0, notDoneCount: 0, activeDeploymentCount: 0, inactiveDeploymentCount: 0 }
  );

  const expenseByTool = new Map();
  cumulativeExpenses.forEach((expense) => {
    const key = expense.toolName.toLowerCase();
    if (!expenseByTool.has(key)) {
      expenseByTool.set(key, { toolName: expense.toolName, cost: 0, cumulativeAmountSpent: 0, periodAmountSpent: 0 });
    }
    const item = expenseByTool.get(key);
    item.cost += Number(expense.cost) || 0;
    item.cumulativeAmountSpent += Number(expense.amountSpent) || 0;
  });
  periodExpenses.forEach((expense) => {
    const key = expense.toolName.toLowerCase();
    if (!expenseByTool.has(key)) {
      expenseByTool.set(key, { toolName: expense.toolName, cost: 0, cumulativeAmountSpent: 0, periodAmountSpent: 0 });
    }
    expenseByTool.get(key).periodAmountSpent += Number(expense.amountSpent) || 0;
  });

  const toolsByName = new Map();
  utilizations.forEach((u) => {
    const key = u.toolName.toLowerCase();
    if (!toolsByName.has(key)) {
      const expense = expenseByTool.get(key);
      toolsByName.set(key, {
        toolName: u.toolName,
        cost: expense?.cost || 0,
        periodAmountSpent: expense?.periodAmountSpent || 0,
        projects: new Set(),
        students: new Set(),
      });
    }
    const item = toolsByName.get(key);
    item.projects.add(u.projectName);
    item.students.add((u.labUserId?._id || u.labUserId)?.toString());
  });

  const tools = Array.from(toolsByName.values()).map((tool) => ({
    toolName: tool.toolName,
    cost: tool.cost,
    periodAmountSpent: tool.periodAmountSpent,
    projectsUsingIt: tool.projects.size,
    studentsUsingIt: tool.students.size,
  }));

  const servedUsers = new Map();
  assignments.forEach((a) => {
    const user = a.labUserId;
    const id = (user?._id || user)?.toString();
    if (id && user?.name) servedUsers.set(id, user);
  });
  utilizations.forEach((u) => {
    const user = u.labUserId;
    const id = (user?._id || user)?.toString();
    if (id && user?.name) servedUsers.set(id, user);
  });

  const servedUserList = Array.from(servedUsers.values());
  const students = {
    total: servedUserList.length,
    departmentBreakdown: makeBreakdown(servedUserList, (u) => u.department),
    userTypeBreakdown: {
      student: 0,
      faculty: 0,
      hod: 0,
      hr: 0,
      employee: 0,
      ...makeBreakdown(servedUserList, (u) => u.userType),
    },
  };

  const labsReport = activityLabIds.map((labId) => {
    const lab = labById.get(labId);
    const labSystems = systemsByLab.get(labId) || [];
    const labUtilizations = utilizations.filter((u) => {
      const labUserId = (u.labUserId?._id || u.labUserId)?.toString();
      return labIdsByLabUser.get(labUserId)?.has(labId);
    });
    // occupancy = distinct systems booked in this lab during the period (slot model)
    const occupiedSystemCount = systemsBookedByLab.get(labId)?.size || 0;
    const assignmentsDuringPeriod = assignmentsBookedByLab.get(labId)?.size || 0;

    return {
      labId,
      labName: lab?.name || 'Unknown lab',
      totalSystems: labSystems.length,
      occupiedSystems: occupiedSystemCount,
      availableSystems: Math.max(labSystems.length - occupiedSystemCount, 0),
      fullyOccupied: labSystems.length > 0 && occupiedSystemCount >= labSystems.length,
      assignmentsDuringPeriod,
      projectsDuringPeriod: uniqueCount(labUtilizations.map((u) => u.projectName)),
      toolsUsed: Array.from(new Set(labUtilizations.map((u) => u.toolName).filter(Boolean))),
    };
  });

  const systemsSummary = {
    totalSystems: systems.length,
    systemsUsedDuringPeriod: usedSystemIds.size,
    systemsFree: Math.max(systems.length - usedSystemIds.size, 0),
    utilizationPercent: systems.length ? Number(((usedSystemIds.size / systems.length) * 100).toFixed(2)) : 0,
  };

  const expenses = {
    periodExpenses: {
      items: periodExpenses.map((expense) => ({
        id: expense._id.toString(),
        toolName: expense.toolName,
        cost: Number(expense.cost) || 0,
        amountSpent: Number(expense.amountSpent) || 0,
        purpose: expense.purpose || '',
        createdAt: expense.createdAt,
      })),
      totalCost: sumField(periodExpenses, 'cost'),
      totalSpent: sumField(periodExpenses, 'amountSpent'),
    },
    cumulativeExpenses: {
      items: cumulativeExpenses.map((expense) => ({
        id: expense._id.toString(),
        toolName: expense.toolName,
        cost: Number(expense.cost) || 0,
        amountSpent: Number(expense.amountSpent) || 0,
        purpose: expense.purpose || '',
        createdAt: expense.createdAt,
      })),
      totalCost: sumField(cumulativeExpenses, 'cost'),
      totalSpent: sumField(cumulativeExpenses, 'amountSpent'),
    },
  };

  const hasActivity = assignments.length > 0 || utilizations.length > 0;

  return {
    metadata: {
      title: buildTitle(type, from, to),
      organization: organization?.name || 'Organization',
      type,
      from,
      to,
      generatedAt: new Date(),
      generatedBy,
      hasActivity,
      emptyMessage: hasActivity ? '' : 'No activity in this period',
    },
    overview: {
      labsWithActivity: activityLabIds.length,
      totalSystems: systemsSummary.totalSystems,
      systemsUsedDuringPeriod: systemsSummary.systemsUsedDuringPeriod,
      systemsFree: systemsSummary.systemsFree,
      utilizationPercent: systemsSummary.utilizationPercent,
      aiToolsModelsUsed: tools.length,
      projectsWorkedOn: uniqueCount(projectRows.map((p) => p.projectName)),
      assignments: assignments.length,
      activeAssignments: assignmentStatusCounts.active,
      nearingExpiryAssignments: assignmentStatusCounts.nearingExpiry,
      expiredAssignments: assignmentStatusCounts.expired,
      studentsUsersServed: students.total,
      periodExpenses: expenses.periodExpenses.totalSpent,
      cumulativeExpenses: expenses.cumulativeExpenses.totalSpent,
    },
    labs: labsReport,
    systems: systemsSummary,
    tools,
    projects: {
      items: projectRows,
      ...projectCounts,
    },
    assignments: {
      items: assignmentRows,
      ...assignmentStatusCounts,
    },
    students,
    expenses,
  };
}

async function generateAndArchiveReport(orgId, generatedBy, payload = {}) {
  const range = resolveDateRange(payload.type, payload);
  const snapshot = await buildReportSnapshot(orgId, range, generatedBy);

  const report = await Report.create({
    orgId,
    generatedBy,
    type: range.type,
    from: range.from,
    to: range.to,
    title: snapshot.metadata.title,
    generatedAt: snapshot.metadata.generatedAt,
    snapshot,
  });

  return {
    success: true,
    reportId: report._id,
    report: snapshot,
  };
}

async function listReports(orgId) {
  const reports = await Report.find({ orgId })
    .select('title type from to generatedAt createdAt snapshot.metadata.organization')
    .sort({ generatedAt: -1 })
    .lean();

  return {
    success: true,
    reports: reports.map((report) => ({
      id: report._id.toString(),
      _id: report._id,
      title: report.title,
      type: report.type,
      from: report.from,
      to: report.to,
      generatedAt: report.generatedAt,
      organization: report.snapshot?.metadata?.organization || '',
    })),
  };
}

async function getArchivedReport(orgId, reportId) {
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    const error = new Error('Report not found.');
    error.statusCode = 404;
    throw error;
  }

  const report = await Report.findOne({ _id: reportId, orgId }).lean();
  if (!report) {
    const error = new Error('Report not found.');
    error.statusCode = 404;
    throw error;
  }

  return { success: true, reportId: report._id, report: report.snapshot };
}

async function deleteArchivedReport(orgId, reportId) {
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    const error = new Error('Report not found.');
    error.statusCode = 404;
    throw error;
  }

  const report = await Report.findOneAndDelete({ _id: reportId, orgId });
  if (!report) {
    const error = new Error('Report not found.');
    error.statusCode = 404;
    throw error;
  }

  return { success: true, message: 'Report deleted successfully.' };
}

const pdfTheme = {
  green: '#008738',
  greenLight: '#EAF7EF',
  greenMid: '#72BD20',
  heading: '#181818',
  text: '#4B5563',
  muted: '#808080',
  border: '#DDE5E2',
  tableHeader: '#F0F4F5',
  white: '#FFFFFF',
  pageBg: '#FFFFFF',
};

const pageBounds = (doc) => ({
  left: doc.page.margins.left,
  right: doc.page.width - doc.page.margins.right,
  top: doc.page.margins.top,
  bottom: doc.page.height - doc.page.margins.bottom - 28,
  width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
});

const titleCaseText = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const moneyText = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

const ensureSpace = (doc, neededHeight) => {
  const bounds = pageBounds(doc);
  if (doc.y + neededHeight > bounds.bottom) {
    doc.addPage();
  }
};

const addReportHeader = (doc, report) => {
  const bounds = pageBounds(doc);
  const startY = doc.y;

  doc
    .roundedRect(bounds.left, startY, bounds.width, 92, 8)
    .fillAndStroke(pdfTheme.greenLight, pdfTheme.border);

  doc
    .font('Helvetica-Bold')
    .fontSize(17)
    .fillColor(pdfTheme.green)
    .text('AI Lab Maintenance - Reports', bounds.left + 18, startY + 14, {
      width: bounds.width - 36,
    });

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(pdfTheme.heading)
    .text(report.metadata.title || 'Report', bounds.left + 18, startY + 40, {
      width: bounds.width - 36,
    });

  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(pdfTheme.text)
    .text(`Organization: ${report.metadata.organization || '-'}`, bounds.left + 18, startY + 61, {
      continued: true,
    })
    .text(`   Type: ${titleCaseText(report.metadata.type)}`, { continued: true })
    .text(`   Period: ${formatDate(report.metadata.from)} to ${formatDate(report.metadata.to)}`);

  doc
    .fontSize(8.5)
    .fillColor(pdfTheme.muted)
    .text(`Generated: ${formatDateTime(report.metadata.generatedAt)}`, bounds.left + 18, startY + 76);

  doc.y = startY + 112;
};

const addSectionTitle = (doc, title) => {
  ensureSpace(doc, 34);
  const bounds = pageBounds(doc);
  doc.moveDown(0.3);
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(pdfTheme.green)
    .text(title, bounds.left, doc.y);
  doc
    .strokeColor(pdfTheme.border)
    .lineWidth(0.8)
    .moveTo(bounds.left, doc.y + 3)
    .lineTo(bounds.right, doc.y + 3)
    .stroke();
  doc.moveDown(0.8);
};

const addEmptyNotice = (doc, message) => {
  const bounds = pageBounds(doc);
  ensureSpace(doc, 42);
  const y = doc.y;
  doc.roundedRect(bounds.left, y, bounds.width, 34, 6).fillAndStroke(pdfTheme.greenLight, pdfTheme.border);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(pdfTheme.heading).text(message, bounds.left + 12, y + 11);
  doc.y = y + 46;
};

const addKpiCards = (doc, cards, columns = 3) => {
  const gap = 10;
  const cardHeight = 54;
  let bounds = pageBounds(doc);
  const cardWidth = (bounds.width - gap * (columns - 1)) / columns;

  for (let rowIndex = 0; rowIndex < cards.length; rowIndex += columns) {
    ensureSpace(doc, cardHeight + 12);
    bounds = pageBounds(doc);
    const rowY = doc.y;
    const rowCards = cards.slice(rowIndex, rowIndex + columns);

    rowCards.forEach((card, column) => {
      const x = bounds.left + column * (cardWidth + gap);

      doc.roundedRect(x, rowY, cardWidth, cardHeight, 7).fillAndStroke(pdfTheme.white, pdfTheme.border);
      doc.rect(x, rowY, 4, cardHeight).fill(pdfTheme.green);
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(pdfTheme.muted)
        .text(card.label, x + 12, rowY + 10, {
          width: cardWidth - 20,
          height: 18,
          lineGap: 1,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(pdfTheme.heading)
        .text(String(card.value), x + 12, rowY + 31, {
          width: cardWidth - 20,
          height: 16,
        });
    });

    doc.y = rowY + cardHeight + 12;
  }
};

const cellTextHeight = (doc, text, width, fontSize = 8) => {
  doc.font('Helvetica').fontSize(fontSize);
  return doc.heightOfString(String(text ?? '-'), { width, lineGap: 1 });
};

const drawStatusBadge = (doc, text, x, y, width) => {
  const label = String(text || '-');
  const color = label === 'ACTIVE' || label === 'done' || label === 'active' ? pdfTheme.green : pdfTheme.muted;
  const badgeWidth = Math.min(width, Math.max(44, doc.widthOfString(label) + 12));

  doc.roundedRect(x, y + 4, badgeWidth, 14, 7).fill(color);
  doc
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .fillColor(pdfTheme.white)
    .text(label, x, y + 7, { width: badgeWidth, align: 'center' });
};

const drawTableHeader = (doc, columns, x, y, tableWidth) => {
  const headerHeight = 24;
  doc.rect(x, y, tableWidth, headerHeight).fillAndStroke(pdfTheme.tableHeader, pdfTheme.border);

  let cursorX = x;
  columns.forEach((column) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(pdfTheme.heading)
      .text(column.label, cursorX + 5, y + 8, { width: column.width - 10, height: 10 });
    cursorX += column.width;
  });

  return y + headerHeight;
};

const addTable = (doc, title, columns, rows, emptyMessage = 'No data available.') => {
  addSectionTitle(doc, title);
  const bounds = pageBounds(doc);
  const x = bounds.left;
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);

  if (!rows || rows.length === 0) {
    addEmptyNotice(doc, emptyMessage);
    return;
  }

  let y = drawTableHeader(doc, columns, x, doc.y, tableWidth);

  rows.forEach((row, rowIndex) => {
    const rowHeights = columns.map((column) => {
      const value = row[column.key];
      if (column.badge) return 24;
      return cellTextHeight(doc, value, column.width - 10, column.fontSize || 7.5) + 12;
    });
    const rowHeight = Math.max(24, ...rowHeights);

    if (y + rowHeight > bounds.bottom) {
      doc.addPage();
      y = drawTableHeader(doc, columns, x, doc.y, tableWidth);
    }

    doc
      .rect(x, y, tableWidth, rowHeight)
      .fillAndStroke(rowIndex % 2 === 0 ? pdfTheme.white : '#FBFCFC', pdfTheme.border);

    let cursorX = x;
    columns.forEach((column) => {
      const value = row[column.key] ?? '-';
      doc.strokeColor(pdfTheme.border).moveTo(cursorX, y).lineTo(cursorX, y + rowHeight).stroke();

      if (column.badge) {
        drawStatusBadge(doc, value, cursorX + 5, y + 3, column.width - 10);
      } else {
        doc
          .font(column.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(column.fontSize || 7.5)
          .fillColor(pdfTheme.text)
          .text(String(value), cursorX + 5, y + 7, {
            width: column.width - 10,
            height: rowHeight - 10,
            align: column.align || 'left',
            lineGap: 1,
          });
      }

      cursorX += column.width;
    });
    doc.strokeColor(pdfTheme.border).moveTo(x + tableWidth, y).lineTo(x + tableWidth, y + rowHeight).stroke();
    y += rowHeight;
  });

  doc.y = y + 14;
};

const addPageFooters = (doc) => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const bounds = pageBounds(doc);
    const footerY = doc.page.height - doc.page.margins.bottom - 12;

    doc
      .strokeColor(pdfTheme.border)
      .lineWidth(0.7)
      .moveTo(bounds.left, footerY - 8)
      .lineTo(bounds.right, footerY - 8)
      .stroke();

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(pdfTheme.muted)
      .text('AI Lab Maintenance - Confidential Administrative Report', bounds.left, footerY, {
        width: bounds.width / 2,
        lineBreak: false,
      })
      .text(`Page ${i + 1} of ${range.count}`, bounds.left, footerY, {
        width: bounds.width,
        align: 'right',
        lineBreak: false,
      });
  }
};

function createReportPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: report.metadata?.title || 'AI Lab Maintenance Report',
        Author: 'AI Lab Maintenance',
        Subject: 'Administrative analytics report',
      },
    });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    addReportHeader(doc, report);

    if (!report.metadata.hasActivity) {
      addEmptyNotice(doc, report.metadata.emptyMessage || 'No activity in this period');
    }

    addSectionTitle(doc, 'Overview');
    addKpiCards(doc, [
      { label: 'Labs With Activity', value: report.overview?.labsWithActivity ?? 0 },
      { label: 'Total Systems', value: report.overview?.totalSystems ?? 0 },
      { label: 'Systems Used', value: report.overview?.systemsUsedDuringPeriod ?? 0 },
      { label: 'Systems Free', value: report.overview?.systemsFree ?? 0 },
      { label: 'Utilization', value: `${report.overview?.utilizationPercent ?? 0}%` },
      { label: 'Tools / Models', value: report.overview?.aiToolsModelsUsed ?? 0 },
      { label: 'Projects', value: report.overview?.projectsWorkedOn ?? 0 },
      { label: 'Users Served', value: report.overview?.studentsUsersServed ?? 0 },
      { label: 'Period Spent', value: moneyText(report.overview?.periodExpenses) },
    ]);

    addTable(
      doc,
      'Lab Breakdown',
      [
        { key: 'labName', label: 'Lab', width: 95, bold: true },
        { key: 'totalSystems', label: 'Total', width: 48, align: 'right' },
        { key: 'occupiedSystems', label: 'Occupied', width: 58, align: 'right' },
        { key: 'availableSystems', label: 'Available', width: 58, align: 'right' },
        { key: 'fullyOccupied', label: 'Full', width: 45 },
        { key: 'assignmentsDuringPeriod', label: 'Assignments', width: 72, align: 'right' },
        { key: 'projectsDuringPeriod', label: 'Projects', width: 58, align: 'right' },
        { key: 'toolsUsed', label: 'Tools / Models', width: 81 },
      ],
      (report.labs || []).map((lab) => ({
        ...lab,
        fullyOccupied: lab.fullyOccupied ? 'Yes' : 'No',
        toolsUsed: lab.toolsUsed?.join(', ') || '-',
      })),
      'No lab activity in this period.'
    );

    addTable(
      doc,
      'Systems & Utilization',
      [
        { key: 'metric', label: 'Metric', width: 220, bold: true },
        { key: 'value', label: 'Value', width: 275, align: 'right' },
      ],
      [
        { metric: 'Total Systems', value: report.systems?.totalSystems ?? 0 },
        { metric: 'Systems Used During Period', value: report.systems?.systemsUsedDuringPeriod ?? 0 },
        { metric: 'Systems Free', value: report.systems?.systemsFree ?? 0 },
        { metric: 'Utilization Percentage', value: `${report.systems?.utilizationPercent ?? 0}%` },
      ]
    );

    addTable(
      doc,
      'Tools / Models',
      [
        { key: 'toolName', label: 'Tool / Model', width: 150, bold: true },
        { key: 'cost', label: 'Cost', width: 85, align: 'right' },
        { key: 'periodAmountSpent', label: 'Period Spent', width: 105, align: 'right' },
        { key: 'projectsUsingIt', label: 'Projects', width: 75, align: 'right' },
        { key: 'studentsUsingIt', label: 'Students', width: 80, align: 'right' },
      ],
      (report.tools || []).map((tool) => ({
        ...tool,
        cost: moneyText(tool.cost),
        periodAmountSpent: moneyText(tool.periodAmountSpent),
      })),
      'No tools or models were used in this period.'
    );

    addTable(
      doc,
      'Projects',
      [
        { key: 'student', label: 'Student', width: 82, bold: true },
        { key: 'toolName', label: 'Tool', width: 75 },
        { key: 'projectName', label: 'Project', width: 118 },
        { key: 'status', label: 'Status', width: 58, badge: true },
        { key: 'deployment', label: 'Deployment', width: 72, badge: true },
        { key: 'liveUrl', label: 'Live URL', width: 90, fontSize: 6.8 },
      ],
      (report.projects?.items || []).map((project) => ({
        ...project,
        status: project.status === 'done' ? 'done' : 'not done',
        deployment: project.deployment || 'inactive',
        liveUrl: project.liveUrl || '-',
      })),
      'No projects were worked on in this period.'
    );

    addTable(
      doc,
      'Assignments',
      [
        { key: 'referenceId', label: 'Reference ID', width: 88, bold: true, fontSize: 6.8 },
        { key: 'student', label: 'Student', width: 70 },
        { key: 'system', label: 'System', width: 58 },
        { key: 'lab', label: 'Lab', width: 65 },
        { key: 'project', label: 'Project', width: 90 },
        { key: 'dateRange', label: 'Duration', width: 76, fontSize: 6.8 },
        { key: 'status', label: 'Status', width: 48, badge: true },
      ],
      (report.assignments?.items || []).map((assignment) => ({
        ...assignment,
        dateRange: `${formatDate(assignment.startDate)} to ${formatDate(assignment.endDate)}`,
      })),
      'No assignments overlap this period.'
    );

    addTable(
      doc,
      'Students / Users - Department Breakdown',
      [
        { key: 'name', label: 'Department', width: 320, bold: true },
        { key: 'count', label: 'Users', width: 175, align: 'right' },
      ],
      Object.entries(report.students?.departmentBreakdown || {}).map(([name, count]) => ({ name, count })),
      'No department activity in this period.'
    );

    addTable(
      doc,
      'Students / Users - User Type Breakdown',
      [
        { key: 'name', label: 'User Type', width: 320, bold: true },
        { key: 'count', label: 'Users', width: 175, align: 'right' },
      ],
      Object.entries(report.students?.userTypeBreakdown || {}).map(([name, count]) => ({
        name: titleCaseText(name),
        count,
      })),
      'No user type activity in this period.'
    );

    addTable(
      doc,
      'Expenses - Period vs Cumulative',
      [
        { key: 'metric', label: 'Metric', width: 180, bold: true },
        { key: 'period', label: 'Period', width: 155, align: 'right' },
        { key: 'cumulative', label: 'Cumulative', width: 160, align: 'right' },
      ],
      [
        {
          metric: 'Total Cost',
          period: moneyText(report.expenses?.periodExpenses?.totalCost),
          cumulative: moneyText(report.expenses?.cumulativeExpenses?.totalCost),
        },
        {
          metric: 'Total Spent',
          period: moneyText(report.expenses?.periodExpenses?.totalSpent),
          cumulative: moneyText(report.expenses?.cumulativeExpenses?.totalSpent),
        },
      ]
    );

    addTable(
      doc,
      'Period Expense Items',
      [
        { key: 'toolName', label: 'Tool / Model', width: 180, bold: true },
        { key: 'cost', label: 'Cost', width: 95, align: 'right' },
        { key: 'amountSpent', label: 'Spent', width: 95, align: 'right' },
        { key: 'createdAt', label: 'Created', width: 125 },
      ],
      (report.expenses?.periodExpenses?.items || []).map((expense) => ({
        ...expense,
        cost: moneyText(expense.cost),
        amountSpent: moneyText(expense.amountSpent),
        createdAt: formatDate(expense.createdAt),
      })),
      'No expenses were created in this period.'
    );

    addPageFooters(doc);
    doc.end();
  });
}

module.exports = {
  resolveDateRange,
  generateAndArchiveReport,
  listReports,
  getArchivedReport,
  deleteArchivedReport,
  createReportPdf,
};
