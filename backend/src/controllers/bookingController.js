// ============================================================
// CONTROLLER: bookingController  (Slot-Booking Module — v2)
// ------------------------------------------------------------
// Thin HTTP layer over bookingService. Every handler derives
// orgId from the JWT (req.orgId, set by orgIsolation) — never
// from the client. Service errors carry a `.statusCode`; we
// map that straight to the response.
// ============================================================

const bookingService = require("../services/bookingService");

function handleError(res, err, fallback) {
    const status = err && err.statusCode ? err.statusCode : 500;
    if (status === 500) console.error(`${fallback}:`, err);
    return res.status(status).json({ success: false, message: err.message || fallback });
}

// GET /api/bookings/availability?labId=&date=YYYY-MM-DD
async function getAvailability(req, res) {
    try {
        const { labId, date } = req.query;
        const data = await bookingService.getAvailability(req.orgId, labId, date);
        return res.json({ success: true, data });
    } catch (err) {
        return handleError(res, err, "Could not load availability");
    }
}

// POST /api/bookings  { labUserId, systemId, date, slotStart }
async function createBooking(req, res) {
    try {
        const { labUserId, systemId, date, slotStart } = req.body;
        const booking = await bookingService.createBooking({
            orgId: req.orgId,
            labUserId,
            systemId,
            dateStr: date,
            slotStart,
            bookedBy: req.user.id,
        });
        return res.status(201).json({ success: true, message: "Slot booked.", data: booking });
    } catch (err) {
        return handleError(res, err, "Could not book slot");
    }
}

// POST /api/bookings/recurring  { labUserId, systemId, slotStart, from, to }
async function createRecurring(req, res) {
    try {
        const { labUserId, systemId, slotStart, from, to } = req.body;
        const result = await bookingService.createRecurring({
            orgId: req.orgId,
            labUserId,
            systemId,
            slotStart,
            fromStr: from,
            toStr: to,
            bookedBy: req.user.id,
        });
        return res.status(201).json({
            success: true,
            message: `Booked ${result.created.length} of ${result.requestedDays} day(s).`,
            data: result,
        });
    } catch (err) {
        return handleError(res, err, "Could not create recurring booking");
    }
}

// PATCH /api/bookings/:id/cancel
async function cancelBooking(req, res) {
    try {
        const booking = await bookingService.cancelBooking(req.orgId, req.params.id);
        return res.json({ success: true, message: "Booking cancelled.", data: booking });
    } catch (err) {
        return handleError(res, err, "Could not cancel booking");
    }
}

// PATCH /api/bookings/:id/check-in
async function checkIn(req, res) {
    try {
        const booking = await bookingService.checkIn(req.orgId, req.params.id);
        return res.json({ success: true, message: "Checked in.", data: booking });
    } catch (err) {
        return handleError(res, err, "Could not check in");
    }
}

// PATCH /api/bookings/:id/check-out
async function checkOut(req, res) {
    try {
        const booking = await bookingService.checkOut(req.orgId, req.params.id);
        return res.json({ success: true, message: "Checked out.", data: booking });
    } catch (err) {
        return handleError(res, err, "Could not check out");
    }
}

// GET /api/bookings/lookup?referenceId=  (the walk-up ID box)
async function lookup(req, res) {
    try {
        const data = await bookingService.lookupByReferenceId(req.orgId, req.query.referenceId);
        return res.json({ success: true, data });
    } catch (err) {
        return handleError(res, err, "Could not look up reference ID");
    }
}

// GET /api/bookings?date=&labUserId=&referenceId=&labId=&includeCancelled=
async function listBookings(req, res) {
    try {
        const { date, labUserId, referenceId, labId, includeCancelled } = req.query;
        const data = await bookingService.listBookings({
            orgId: req.orgId,
            dateStr: date,
            labUserId,
            referenceId,
            labId,
            includeCancelled: includeCancelled === "true",
        });
        return res.json({ success: true, data });
    } catch (err) {
        return handleError(res, err, "Could not load bookings");
    }
}

module.exports = {
    getAvailability,
    createBooking,
    createRecurring,
    cancelBooking,
    checkIn,
    checkOut,
    listBookings,
    lookup,
};
