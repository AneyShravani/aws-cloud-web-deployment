// ============================================================
// CONTROLLER: studentController  (the student portal API)
// ------------------------------------------------------------
// Everything a logged-in STUDENT needs for their own world:
//   GET   /overview            -> profile + live access + strike meter
//   GET   /labs                -> labs they can book in (org-scoped)
//   GET   /availability        -> a lab's system×slot grid for a date
//   GET   /bookings            -> their own bookings (upcoming + past)
//   POST  /bookings            -> book a slot FOR THEMSELVES
//   PATCH /bookings/:id/cancel -> cancel their own upcoming slot
//
// Booking endpoints sit behind requireActiveAccess (see routes), so
// an expired/blocked student is refused server-side, not just in UI.
// The student can never book for anyone else: labUserId is derived
// from their own account, never taken from the request body.
// ============================================================

const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');
const Lab = require('../models/Lab');
const Booking = require('../models/Booking');
const Assignment = require('../models/Assignment');
const bookingService = require('../services/bookingService');
const { getAccess, assignmentForDate, activeProjects, labUserIdsFor } = require('../services/studentAccessService');
const { strikeStatus } = require('../services/strikeService');
const slot = require('../services/slotService');

const handle = (res, err, fallback) => {
  if (err && [400, 403, 404, 409, 422].includes(err.statusCode)) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  console.error(fallback, err);
  return res.status(500).json({ success: false, message: 'Internal Server Error' });
};

// GET /api/student/overview — the single read the portal boots from.
async function overview(req, res) {
  try {
    const account = await AdminUser.findById(req.user.id).populate('orgId', 'name');
    if (!account) return res.status(401).json({ success: false, message: 'Account not found.' });

    const access = await getAccess(account);
    return res.json({
      success: true,
      profile: {
        name: account.name,
        email: account.email,
        rollNumber: account.rollNumber || '',
        department: account.department || '',
        userType: account.userType || 'student',
        organizationName: account.orgId?.name || '',
      },
      access,
      projects: await activeProjects(account), // live projects (for the booking picker)
      strike: strikeStatus(account),
    });
  } catch (err) {
    return handle(res, err, 'student overview failed:');
  }
}

// GET /api/student/labs — labs in the student's org (for the booking picker).
async function labs(req, res) {
  try {
    const list = await Lab.find({ orgId: req.user.orgId }).sort({ name: 1 }).select('name building floor labNumber').lean();
    return res.json({ success: true, data: list });
  } catch (err) {
    return handle(res, err, 'student labs failed:');
  }
}

// GET /api/student/availability?labId=&date= — the bookable grid.
async function availability(req, res) {
  try {
    const { labId, date } = req.query;
    const grid = await bookingService.getAvailability(req.user.orgId, labId, date);
    return res.json({ success: true, data: grid });
  } catch (err) {
    return handle(res, err, 'student availability failed:');
  }
}

// POST /api/student/bookings — book one slot for the logged-in student.
async function createBooking(req, res) {
  try {
    const orgId = req.user.orgId;
    const { systemId, date, slotStart, projectId } = req.body;
    if (!systemId || !date || !slotStart) {
      return res.status(400).json({ success: false, message: 'systemId, date and slotStart are required.' });
    }

    const dateOnly = slot.parseDateOnly(date);
    let umbrella;
    if (projectId) {
      // student explicitly chose which project (they hold more than one) —
      // verify it's theirs and that its window covers the date
      umbrella = await Assignment.findOne({ _id: projectId, orgId });
      const ids = (await labUserIdsFor(req.user.id, orgId)).map(String);
      if (!umbrella || !ids.includes(String(umbrella.labUserId))) {
        return res.status(403).json({ success: false, message: 'That project is not yours to book under.' });
      }
      if (!(new Date(umbrella.startDate) <= dateOnly && new Date(umbrella.endDate) >= dateOnly)) {
        return res.status(409).json({ success: false, message: 'That date is outside the selected project\'s window.' });
      }
    } else {
      // otherwise resolve WHICH of the student's approvals covers this date
      umbrella = await assignmentForDate(req.user.id, orgId, dateOnly);
    }
    if (!umbrella) {
      return res.status(409).json({ success: false, message: 'You have no approved window covering that date.' });
    }

    const booking = await bookingService.createBooking({
      orgId,
      labUserId: umbrella.labUserId, // the student's own requester record — never from the body
      systemId,
      dateStr: date,
      slotStart,
      bookedBy: req.user.id,
    });
    return res.status(201).json({ success: true, data: booking });
  } catch (err) {
    return handle(res, err, 'student booking failed:');
  }
}

// GET /api/student/bookings — the student's own reservations.
async function myBookings(req, res) {
  try {
    const orgId = req.user.orgId;
    const ids = await labUserIdsFor(req.user.id, orgId);
    if (!ids.length) return res.json({ success: true, data: [] });

    // keep statuses honest before reading
    await bookingService.reconcileBookings({ orgId, labUserId: { $in: ids } });

    const rows = await Booking.find({ orgId, labUserId: { $in: ids }, isActive: true })
      .sort({ date: -1, slotStart: 1 })
      .populate({ path: 'systemId', select: 'name labId', populate: { path: 'labId', select: 'name' } })
      .lean();

    const data = rows.map((b) => ({
      bookingId: b._id,
      date: slot.ymd(b.date),
      slotStart: b.slotStart,
      slotEnd: b.slotEnd,
      status: b.status,
      systemName: b.systemId?.name || '—',
      labName: b.systemId?.labId?.name || '—',
      checkIn: b.actualCheckIn,
      checkOut: b.actualCheckOut,
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return handle(res, err, 'student my-bookings failed:');
  }
}

// PATCH /api/student/bookings/:id/cancel — cancel own upcoming slot.
async function cancelBooking(req, res) {
  try {
    const orgId = req.user.orgId;
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid booking id.' });

    const booking = await Booking.findOne({ _id: id, orgId });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    // ownership: the booking's requester must belong to this account
    const ids = (await labUserIdsFor(req.user.id, orgId)).map(String);
    if (!ids.includes(String(booking.labUserId))) {
      return res.status(403).json({ success: false, message: 'This booking is not yours to cancel.' });
    }
    if (booking.status !== 'BOOKED') {
      return res.status(409).json({ success: false, message: 'Only an upcoming, un-started slot can be cancelled.' });
    }

    const updated = await bookingService.cancelBooking(orgId, id);
    return res.json({ success: true, data: { bookingId: updated._id, status: updated.status } });
  } catch (err) {
    return handle(res, err, 'student cancel failed:');
  }
}

module.exports = { overview, labs, availability, createBooking, myBookings, cancelBooking };
