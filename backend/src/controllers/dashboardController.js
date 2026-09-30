// ============================================================
// CONTROLLER: dashboardController  (Module 3.1)
// ------------------------------------------------------------
// getStats         -> aggregate counts for THIS org only:
//                     students, systems, tools, total expenses,
//                     active assignments, upcoming deadlines.
// getOccupancy     -> per lab: total / occupied / available
//                     + "fully occupied" flag when available=0.
// checkReferenceId -> look up an Assignment by referenceId,
//                     return ACTIVE / NEARING_EXPIRY / EXPIRED
//                     + assignment details.
// getNotifications -> unread deadline notifications.
// ============================================================

const Lab = require('../models/Lab');
const System = require('../models/System');
const Expense = require('../models/Expense');
const Assignment = require('../models/Assignment');
const Booking = require('../models/Booking');
const { getStatus } = require('../services/referenceIdService');
const slot = require('../services/slotService');
const bookingService = require('../services/bookingService');

const getStats = async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const today = slot.parseDateOnly(slot.todayYMD_IST());

    const [labCount, systemCount, expenses, activeAssignments, todaysBookings, checkedIn] = await Promise.all([
      Lab.countDocuments({ orgId }),
      System.countDocuments({ orgId }),
      Expense.find({ orgId }),
      Assignment.countDocuments({ orgId, status: 'ACTIVE' }),
      Booking.countDocuments({ orgId, date: today, isActive: true }),          // slots booked today
      Booking.countDocuments({ orgId, date: today, status: 'CHECKED_IN' }),    // currently checked in
    ]);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.cost, 0);
    const totalSpent = expenses.reduce((sum, e) => sum + e.amountSpent, 0);

    return res.status(200).json({
      success: true,
      stats: {
        labCount,
        systemCount,
        toolCount: expenses.length,
        totalExpenses,
        totalSpent,
        activeAssignments, // active approvals (umbrellas)
        todaysBookings,
        checkedIn,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// v2 slot-booking: occupancy is now TIME-BASED, not a permanent flag.
//  - busyNow  = systems with a live (BOOKED/CHECKED_IN) booking covering
//               the current IST slot right now.
//  - today's utilization = slots booked today / total bookable slots today
//               (systems × slots-per-day from each lab's schedule).
const getOccupancy = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const labs = await Lab.find({ orgId });

    const today = slot.parseDateOnly(slot.todayYMD_IST());
    const nowHHMM = slot.nowHHMM_IST();

    const occupancy = await Promise.all(
      labs.map(async (lab) => {
        const total = await System.countDocuments({ orgId, labId: lab._id });

        const config = await bookingService.getEffectiveConfig(orgId, lab._id);
        const working = slot.isWorkingDay(config, today);
        const slotsPerDay = working ? slot.generateSlots(config).length : 0;
        const slotCapacity = total * slotsPerDay;

        const todays = await Booking.find({ orgId, labId: lab._id, date: today, isActive: true })
          .select('systemId slotStart slotEnd status')
          .lean();

        const slotsBooked = todays.length;
        const utilizationPct = slotCapacity > 0 ? Math.round((slotsBooked / slotCapacity) * 100) : 0;

        // systems occupied at this exact moment
        const busySystems = new Set();
        for (const b of todays) {
          const live = b.status === 'BOOKED' || b.status === 'CHECKED_IN';
          if (live && b.slotStart <= nowHHMM && nowHHMM < b.slotEnd) {
            busySystems.add(String(b.systemId));
          }
        }
        const busyNow = busySystems.size;
        const freeNow = Math.max(0, total - busyNow);

        return {
          labId: lab._id,
          labName: lab.name,
          total,
          busyNow,
          freeNow,
          slotsBooked,
          slotCapacity,
          utilizationPct,
          working,
          fullyOccupiedNow: total > 0 && busyNow === total,
        };
      })
    );

    return res.status(200).json({ success: true, occupancy });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// GET /api/dashboard/reference/:refId
// v2: an approval no longer pins one machine — return the user's live status
// plus the slots they hold TODAY (system + time), so the desk sees what's on.
const checkReferenceId = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const { refId } = req.params;

    const assignment = await Assignment.findOne({ referenceId: refId, orgId })
      .populate('labUserId', 'name rollNumber department');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'No user found with that Reference ID.',
      });
    }

    const liveStatus = getStatus(assignment);
    const today = slot.parseDateOnly(slot.todayYMD_IST());

    const todays = await Booking.find({
      orgId,
      labUserId: assignment.labUserId?._id || assignment.labUserId,
      date: today,
      isActive: true,
    })
      .select('slotStart slotEnd status systemId')
      .populate('systemId', 'name')
      .sort({ slotStart: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      status: liveStatus,
      referenceId: assignment.referenceId,
      projectName: assignment.projectName,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      user: {
        name: assignment.labUserId?.name || '—',
        rollNumber: assignment.labUserId?.rollNumber || '—',
        department: assignment.labUserId?.department || '—',
      },
      todaysBookings: todays.map((b) => ({
        slotStart: b.slotStart,
        slotEnd: b.slotEnd,
        status: b.status,
        systemName: b.systemId?.name || '—',
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = { getStats, getOccupancy, checkReferenceId };