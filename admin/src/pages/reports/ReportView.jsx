import React from 'react';
import { FileBarChart2, Building2, Clock, Download } from 'lucide-react';
import './ReportsPage.css';

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB');
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB');
};

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Friendly period headline, e.g. "11 Aug 2026 – 12 Aug 2026" (or a single
// date when from === to). Falls back to the report title if dates are missing.
const prettyDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const periodHeadline = (metadata = {}) => {
  const from = prettyDate(metadata.from);
  const to = prettyDate(metadata.to);
  if (!from && !to) return (metadata.title || 'Report').replace(/\s*\([^)]*\)\s*$/, '');
  if (!from) return to;
  if (!to || from === to) return from;
  return `${from} – ${to}`;
};

const titleCase = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

function ReportKpiGrid({ items, className = '' }) {
  return (
    <div className={`report-kpi-grid ${className}`}>
      {items.map((item) => (
        <div className="report-kpi-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function ReportTable({ columns, rows, emptyState, className = '' }) {
  if (!rows || rows.length === 0) {
    return <div className="report-table-empty">{emptyState}</div>;
  }

  return (
    <div className={`report-table-wrap ${className}`}>
      <table className="report-table">
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align === 'right' ? 'is-right' : ''}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id || row.referenceId || `${rowIndex}`}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={[
                    column.align === 'right' ? 'is-right' : '',
                    column.compact ? 'is-compact' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {column.render ? column.render(row) : row[column.key] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportView({ report, onDownload, downloading }) {
  if (!report) return null;

  const overviewCards = [
    { label: 'Labs', value: report.overview?.labsWithActivity ?? 0 },
    { label: 'Systems', value: report.overview?.totalSystems ?? 0 },
    { label: 'Systems Used', value: report.overview?.systemsUsedDuringPeriod ?? 0 },
    { label: 'Systems Free', value: report.overview?.systemsFree ?? 0 },
    { label: 'Utilization', value: `${report.overview?.utilizationPercent ?? 0}%` },
    { label: 'Tools / Models', value: report.overview?.aiToolsModelsUsed ?? 0 },
    { label: 'Projects', value: report.overview?.projectsWorkedOn ?? 0 },
    { label: 'Users Served', value: report.overview?.studentsUsersServed ?? 0 },
    { label: 'Period Spent', value: money(report.overview?.periodExpenses) },
  ];

  const expenseCards = [
    { label: 'Period Cost', value: money(report.expenses?.periodExpenses?.totalCost) },
    { label: 'Period Spent', value: money(report.expenses?.periodExpenses?.totalSpent) },
    { label: 'Cumulative Cost', value: money(report.expenses?.cumulativeExpenses?.totalCost) },
    { label: 'Cumulative Spent', value: money(report.expenses?.cumulativeExpenses?.totalSpent) },
  ];

  return (
    <div className="report-view">
      <div className="report-view-header">
        <div className="report-view-head-main">
          <span className="report-view-eyebrow"><FileBarChart2 size={13} strokeWidth={2.4} /> {titleCase(report.metadata?.type)} report</span>
          <h2>{periodHeadline(report.metadata)}</h2>
          <div className="report-view-meta">
            <span className="report-meta-chip"><Building2 size={13} /> {report.metadata?.organization || 'Organization'}</span>
            <span className="report-meta-chip"><Clock size={13} /> Generated {formatDateTime(report.metadata?.generatedAt)}</span>
          </div>
        </div>
        {onDownload && (
          <button className="report-action-btn" onClick={onDownload} disabled={downloading} type="button">
            <Download size={15} /> {downloading ? 'Downloading…' : 'Download PDF'}
          </button>
        )}
      </div>

      {!report.metadata?.hasActivity && (
        <div className="report-empty-message">{report.metadata?.emptyMessage || 'No activity in this period'}</div>
      )}

      <section className="report-section">
        <h3>Overview</h3>
        <ReportKpiGrid items={overviewCards} />
      </section>

      <section className="report-section">
        <h3>Lab Breakdown</h3>
        <ReportTable
          className="report-table-wide report-lab-table"
          columns={[
            { key: 'labName', label: 'Lab', width: '170px' },
            { key: 'totalSystems', label: 'Total', align: 'right', width: '80px' },
            { key: 'occupiedSystems', label: 'Occupied', align: 'right', width: '95px' },
            { key: 'availableSystems', label: 'Available', align: 'right', width: '95px' },
            { key: 'fullyOccupied', label: 'Full', width: '70px' },
            { key: 'assignmentsDuringPeriod', label: 'Assignments', align: 'right', width: '120px' },
            { key: 'projectsDuringPeriod', label: 'Projects', align: 'right', width: '90px' },
            { key: 'toolsUsed', label: 'Tools', width: '220px' },
          ]}
          rows={(report.labs || []).map((lab) => ({
            ...lab,
            fullyOccupied: lab.fullyOccupied ? 'Yes' : 'No',
            toolsUsed: lab.toolsUsed?.join(', ') || '-',
          }))}
          emptyState="No activity in this period"
        />
      </section>

      <section className="report-section">
        <h3>Systems &amp; Utilization</h3>
        <ReportTable
          columns={[
            { key: 'metric', label: 'Metric', width: '65%' },
            { key: 'value', label: 'Value', align: 'right', width: '35%' },
          ]}
          rows={[
            { metric: 'Total Systems', value: report.systems?.totalSystems ?? 0 },
            { metric: 'Systems Used During Period', value: report.systems?.systemsUsedDuringPeriod ?? 0 },
            { metric: 'Systems Free', value: report.systems?.systemsFree ?? 0 },
            { metric: 'Utilization', value: `${report.systems?.utilizationPercent ?? 0}%` },
          ]}
          emptyState="No system data available."
        />
      </section>

      <section className="report-section">
        <h3>Tools &amp; Models</h3>
        <ReportTable
          className="report-table-wide report-tools-table"
          columns={[
            { key: 'toolName', label: 'Tool / Model', width: '220px' },
            { key: 'cost', label: 'Cost', align: 'right', width: '120px' },
            { key: 'periodAmountSpent', label: 'Period Spent', align: 'right', width: '130px' },
            { key: 'projectsUsingIt', label: 'Projects', align: 'right', width: '100px' },
            { key: 'studentsUsingIt', label: 'Students', align: 'right', width: '100px' },
          ]}
          rows={(report.tools || []).map((tool) => ({
            ...tool,
            cost: money(tool.cost),
            periodAmountSpent: money(tool.periodAmountSpent),
          }))}
          emptyState="No tools/models used in this period."
        />
      </section>

      <section className="report-section">
        <h3>Projects</h3>
        <div className="report-inline-summary">
          <span className="is-success">Done: {report.projects?.doneCount ?? 0}</span>
          <span className="is-muted">Not Done: {report.projects?.notDoneCount ?? 0}</span>
          <span className="is-success">Active Deployments: {report.projects?.activeDeploymentCount ?? 0}</span>
          <span className="is-muted">Inactive Deployments: {report.projects?.inactiveDeploymentCount ?? 0}</span>
        </div>
        <ReportTable
          className="report-table-wide report-projects-table"
          columns={[
            { key: 'student', label: 'Student', width: '130px' },
            { key: 'toolName', label: 'Tool / Model', width: '140px' },
            { key: 'projectName', label: 'Project', width: '260px' },
            { key: 'statusLabel', label: 'Status', width: '105px' },
            { key: 'deploymentLabel', label: 'Deployment', width: '125px' },
            { key: 'liveUrlNode', label: 'Live URL', width: '110px' },
          ]}
          rows={(report.projects?.items || []).map((project) => ({
            ...project,
            statusLabel: project.status === 'done' ? 'Done' : 'Not Done',
            deploymentLabel: titleCase(project.deployment),
            liveUrlNode: project.liveUrl ? (
              <a href={project.liveUrl} target="_blank" rel="noreferrer" className="report-link">
                Open
              </a>
            ) : (
              '-'
            ),
          }))}
          emptyState="No projects worked on in this period."
        />
      </section>

      <section className="report-section">
        <h3>Assignments</h3>
        <div className="report-status-summary">
          <span className="is-active">Active: {report.assignments?.active ?? 0}</span>
          <span className="is-nearing">Nearing Expiry: {report.assignments?.nearingExpiry ?? 0}</span>
          <span className="is-expired">Expired: {report.assignments?.expired ?? 0}</span>
        </div>
        <ReportTable
          className="report-table-wide report-assignments-table"
          columns={[
            { key: 'referenceId', label: 'Reference ID', width: '160px', compact: true },
            { key: 'student', label: 'Student', width: '130px' },
            { key: 'system', label: 'System', width: '105px' },
            { key: 'lab', label: 'Lab', width: '120px' },
            { key: 'project', label: 'Project', width: '190px' },
            { key: 'start', label: 'Start', width: '95px', compact: true },
            { key: 'end', label: 'End', width: '95px', compact: true },
            { key: 'status', label: 'Status', width: '115px', compact: true },
          ]}
          rows={(report.assignments?.items || []).map((assignment) => ({
            ...assignment,
            start: formatDate(assignment.startDate),
            end: formatDate(assignment.endDate),
          }))}
          emptyState="No assignments overlap this period."
        />
      </section>

      <section className="report-section">
        <h3>Students / Users</h3>
        <div className="report-two-col">
          <div>
            <h4>Departments</h4>
            <ReportTable
              columns={[
                { key: 'name', label: 'Department', width: '70%' },
                { key: 'count', label: 'Users', align: 'right', width: '30%' },
              ]}
              rows={Object.entries(report.students?.departmentBreakdown || {}).map(([name, count]) => ({ name, count }))}
              emptyState="No department activity."
            />
          </div>
          <div>
            <h4>User Types</h4>
            <ReportTable
              columns={[
                { key: 'name', label: 'User Type', width: '70%' },
                { key: 'count', label: 'Users', align: 'right', width: '30%' },
              ]}
              rows={Object.entries(report.students?.userTypeBreakdown || {}).map(([name, count]) => ({
                name: titleCase(name),
                count,
              }))}
              emptyState="No user activity."
            />
          </div>
        </div>
      </section>

      <section className="report-section">
        <h3>Expenses</h3>
        <ReportKpiGrid items={expenseCards} className="report-expense-grid" />
        <ReportTable
          className="report-table-wide report-expense-table"
          columns={[
            { key: 'toolName', label: 'Tool / Model', width: '240px' },
            { key: 'cost', label: 'Cost', align: 'right', width: '120px' },
            { key: 'amountSpent', label: 'Spent', align: 'right', width: '120px' },
            { key: 'createdAt', label: 'Created', width: '120px' },
          ]}
          rows={(report.expenses?.periodExpenses?.items || []).map((expense) => ({
            ...expense,
            cost: money(expense.cost),
            amountSpent: money(expense.amountSpent),
            createdAt: formatDate(expense.createdAt),
          }))}
          emptyState="No expenses created in this period."
        />
      </section>
    </div>
  );
}

export default ReportView;
