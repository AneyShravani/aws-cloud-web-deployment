// ============================================================
// SERVICE: bookingService  (Slot-Booking Module — v2)
// ------------------------------------------------------------
// All booking business logic in one place. Controllers stay thin.
//
//  - getEffectiveConfig(orgId, labId) -> lab config, else org
//    default, else the built-in default.
//  - getAvailability(orgId, labId, date) -> the system×slot grid.
//  - createBooking(...) -> one slot, enforcing:
//        D2 booking date within the user's approval window,
//        D3 user can't hold two systems in the same slot,
//        working-day + valid-slot, not-in-the-past,
//        and the DB's race-safe unique index (double-book -> 409).
//  - createRecurring(...) -> repeat a slot across a range,
//    auto-skipping taken/invalid days and reporting what it skipped.
//  - cancelBooking / checkIn / checkOut -> status transitions.
//  - listBookings(...) -> console + ID-box reads.
// ============================================================

const mongoose = require("mongoose");
const SlotConfig = require("../models/SlotConfig");
const Booking = require("../models/Booking");
const Assignment = require("../models/Assignment");
const System = require("../models/System");
const LabUser = require("../models/LabUser");
const slot = require("./slotService");
const { getStatus } = require("./referenceIdService");
const { chargeNoShows } = require("./strikeService");

const MAX_RECURRING_DAYS = 120; // safety cap on a single recurring request

const DEFAULT_CONFIG = {
    openTime: "09:00",
    closeTime: "16:00",
    slotMinutes: 60,
    breaks: [{ start: "12:00", end: "13:00" }],
    workingDays: [1, 2, 3, 4, 5, 6],
};

function httpError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

// ---- config ----------------------------------------------------
async function getEffectiveConfig(orgId, labId) {
    if (labId) {
        const own = await SlotConfig.findOne({ orgId, labId });
        if (own) return own;
    }
    const orgDefault = await SlotConfig.findOne({ orgId, labId: null });
    return orgDefault || DEFAULT_CONFIG;
}

// ---- approval umbrella -----------------------------------------
// The Assignment whose [startDate, endDate] window covers `date`.
// This is what makes a booking legitimate (D2) and supplies the
// referenceId + assignmentId the booking is filed under.
async function resolveUmbrellaForDate(orgId, labUserId, date) {
    return Assignment.findOne({
        orgId,
        labUserId,
        startDate: { $lte: date },
        endDate: { $gte: date },
    }).sort({ createdAt: -1 });
}

// ---- availability ----------------------------------------------
async function getAvailability(orgId, labId, dateStr) {
    if (!labId) throw httpError(400, "labId is required.");
    const date = slot.parseDateOnly(dateStr);
    const config = await getEffectiveConfig(orgId, labId);
    const slots = slot.generateSlots(config);
    const working = slot.isWorkingDay(config, date);

    // keep statuses honest (auto no-show / auto check-out) before we read them
    await reconcileBookings({ orgId, labId, date });

    const systems = await System.find({ orgId, labId }).sort({ name: 1 }).lean();

    const bookings = working
        ? await Booking.find({ orgId, labId, date, isActive: true })
              .populate("labUserId", "name rollNumber")
              .lean()
        : [];

    // index bookings by systemId+slotStart for O(1) grid fill
    const byKey = new Map();
    for (const b of bookings) {
        byKey.set(`${b.systemId}_${b.slotStart}`, b);
    }

    const systemsGrid = systems.map((sys) => ({
        systemId: sys._id,
        name: sys.name,
        slots: slots.map((s) => {
            const b = byKey.get(`${sys._id}_${s.start}`);
            return {
                index: s.index,
                start: s.start,
                end: s.end,
                booking: b
                    ? {
                          bookingId: b._id,
                          labUserId: b.labUserId?._id || b.labUserId,
                          userName: b.labUserId?.name || "—",
                          rollNumber: b.labUserId?.rollNumber || "",
                          status: b.status,
                          checkIn: b.actualCheckIn || null,
                          checkOut: b.actualCheckOut || null,
                      }
                    : null,
            };
        }),
    }));

    return {
        date: slot.ymd(date),
        isWorkingDay: working,
        config: {
            openTime: config.openTime,
            closeTime: config.closeTime,
            slotMinutes: config.slotMinutes,
            breaks: config.breaks,
            workingDays: config.workingDays,
        },
        slots,
        systems: systemsGrid,
    };
}

// ---- shared validation for a single (system, date, slot) -------
async function validateBookable({ orgId, labUserId, systemId, date, slotStart }) {
    if (!labUserId || !systemId || !slotStart) {
        throw httpError(400, "labUserId, systemId and slotStart are required.");
    }

    const system = await System.findOne({ _id: systemId, orgId });
    if (!system) throw httpError(404, "System not found in this organization.");

    const labUser = await LabUser.findOne({ _id: labUserId, orgId });
    if (!labUser) throw httpError(404, "User not found in this organization.");

    // not in the past (IST calendar day)
    if (slot.ymd(date) < slot.todayYMD_IST()) {
        throw httpError(400, "Cannot book a slot in the past.");
    }

    const config = await getEffectiveConfig(orgId, system.labId);
    if (!slot.isWorkingDay(config, date)) {
        throw httpError(400, "That day is not a working day for this lab.");
    }
    const theSlot = slot.findSlot(config, slotStart);
    if (!theSlot) throw httpError(400, `"${slotStart}" is not a valid slot for this lab.`);

    // same calendar day: the slot must not have already ended in IST — otherwise
    // the booking would be instantly reconciled to NO_SHOW (nobody could use it).
    if (slot.ymd(date) === slot.todayYMD_IST()
        && slot.toMinutes(theSlot.end) <= slot.toMinutes(slot.nowHHMM_IST())) {
        throw httpError(400, "This slot has already ended for today. Pick a slot that hasn't passed.");
    }

    // D2 — within an approval window
    const umbrella = await resolveUmbrellaForDate(orgId, labUserId, date);
    if (!umbrella) {
        throw httpError(409, "This user has no approved project window covering that date.");
    }

    // D3 — no other active booking for this user in the same slot on another system
    const clash = await Booking.findOne({
        orgId,
        labUserId,
        date,
        slotStart,
        isActive: true,
        systemId: { $ne: systemId },
    });
    if (clash) {
        throw httpError(409, "This user already has another system booked in that slot.");
    }

    return { system, labUser, umbrella, theSlot };
}

// ---- create one booking ----------------------------------------
async function createBooking({ orgId, labUserId, systemId, dateStr, slotStart, bookedBy }) {
    const date = slot.parseDateOnly(dateStr);
    const { system, umbrella, theSlot } = await validateBookable({
        orgId,
        labUserId,
        systemId,
        date,
        slotStart,
    });

    try {
        const booking = await Booking.create({
            orgId,
            labId: system.labId,
            systemId,
            labUserId,
            assignmentId: umbrella._id,
            date,
            slotStart: theSlot.start,
            slotEnd: theSlot.end,
            status: "BOOKED",
            isActive: true,
            bookedBy: bookedBy || null,
        });
        return booking;
    } catch (err) {
        // race-safe: the partial-unique index rejected a concurrent double-book
        if (err && err.code === 11000) {
            throw httpError(409, "That slot was just booked by someone else.");
        }
        throw err;
    }
}

// ---- create a recurring series ---------------------------------
// Repeats one slot on one system across [fromStr, toStr], clamped to
// the user's approval window, skipping non-working days and any day
// whose slot is already taken (or clashes). Returns created + skipped.
async function createRecurring({ orgId, labUserId, systemId, slotStart, fromStr, toStr, bookedBy }) {
    if (!systemId || !slotStart || !fromStr || !toStr) {
        throw httpError(400, "systemId, slotStart, from and to are required.");
    }
    const from = slot.parseDateOnly(fromStr);
    const to = slot.parseDateOnly(toStr);
    if (to < from) throw httpError(400, "'to' must be on or after 'from'.");

    const spanDays = Math.round((to - from) / 86400000) + 1;
    if (spanDays > MAX_RECURRING_DAYS) {
        throw httpError(400, `Recurring range too large (max ${MAX_RECURRING_DAYS} days).`);
    }

    const created = [];
    const skipped = [];

    for (let ms = from.getTime(); ms <= to.getTime(); ms += 86400000) {
        const day = new Date(ms);
        const dayStr = slot.ymd(day);
        try {
            const booking = await createBooking({
                orgId,
                labUserId,
                systemId,
                dateStr: dayStr,
                slotStart,
                bookedBy,
            });
            created.push({ date: dayStr, bookingId: booking._id });
        } catch (err) {
            skipped.push({ date: dayStr, reason: err.message || "Skipped." });
        }
    }

    return { created, skipped, requestedDays: spanDays };
}

// ---- status transitions ----------------------------------------
async function cancelBooking(orgId, id) {
    if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid booking id.");
    const booking = await Booking.findOne({ _id: id, orgId });
    if (!booking) throw httpError(404, "Booking not found.");
    if (booking.status === "CANCELLED") return booking;

    booking.status = "CANCELLED";
    booking.isActive = false; // frees the slot immediately (unique index no longer applies)
    await booking.save();
    return booking;
}

// Reconcile past-due bookings so attendance reflects reality even when nobody
// clicked anything:
//   BOOKED     + slot ended  -> NO_SHOW
//   CHECKED_IN + slot ended  -> COMPLETED (auto check-out stamped at slot end)
// Called at the top of the read paths and by a periodic sweep in server.js.
async function reconcileBookings(filter = {}) {
    const now = new Date();
    const q = { ...filter, isActive: true, status: { $in: ["BOOKED", "CHECKED_IN"] } };
    // limit the scan to past/today unless a caller pinned a specific date
    if (q.date === undefined) q.date = { $lte: slot.parseDateOnly(slot.todayYMD_IST()) };

    const candidates = await Booking.find(q).select("date slotEnd status actualCheckOut labUserId strikeApplied");

    const ops = [];
    const noShows = []; // freshly no-showed bookings to charge as strikes
    for (const b of candidates) {
        const endAt = slot.istTimeToInstant(b.date, b.slotEnd);
        if (now <= endAt) continue; // slot still running or in the future
        if (b.status === "BOOKED") {
            // mark the no-show AND flag the strike as applied in the same write
            ops.push({ updateOne: { filter: { _id: b._id }, update: { $set: { status: "NO_SHOW", strikeApplied: true } } } });
            if (!b.strikeApplied) noShows.push({ _id: b._id, labUserId: b.labUserId });
        } else {
            ops.push({
                updateOne: {
                    filter: { _id: b._id },
                    update: { $set: { status: "COMPLETED", actualCheckOut: b.actualCheckOut || endAt } },
                },
            });
        }
    }
    if (ops.length) await Booking.bulkWrite(ops);
    // charge strikes AFTER the status write so a crash can't double-count
    if (noShows.length) await chargeNoShows(noShows);
    return ops.length;
}

// Check IN — only valid DURING the booked slot (they're physically present).
// Stamps the real current time. Before it starts / after it ends is rejected;
// an already-ended un-checked-in slot is a no-show.
async function checkIn(orgId, id) {
    if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid booking id.");
    const booking = await Booking.findOne({ _id: id, orgId });
    if (!booking) throw httpError(404, "Booking not found.");
    if (booking.status === "CANCELLED") throw httpError(409, "This booking was cancelled.");
    if (booking.status === "CHECKED_IN") return booking; // idempotent
    if (booking.status === "COMPLETED") throw httpError(409, "This slot is already completed.");

    const now = new Date();
    const startAt = slot.istTimeToInstant(booking.date, booking.slotStart);
    const endAt = slot.istTimeToInstant(booking.date, booking.slotEnd);

    if (now < startAt) {
        throw httpError(422, `This slot starts at ${booking.slotStart} — you can check in once it begins.`);
    }
    if (now > endAt) {
        // the slot is over and they never showed — record the no-show + strike
        if (booking.status === "BOOKED") {
            booking.status = "NO_SHOW";
            if (!booking.strikeApplied) {
                booking.strikeApplied = true;
                await booking.save();
                await chargeNoShows([{ _id: booking._id, labUserId: booking.labUserId }]);
            } else {
                await booking.save();
            }
        }
        throw httpError(422, `The ${booking.slotStart}–${booking.slotEnd} slot has already ended.`);
    }

    booking.status = "CHECKED_IN";
    booking.actualCheckIn = now;
    await booking.save();
    return booking;
}

// Check OUT — manual (usually early). Stamps the current time; if it somehow
// runs past the slot end, cap it at the slot end. A forgotten check-out is
// handled automatically by reconcileBookings.
async function checkOut(orgId, id) {
    if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid booking id.");
    const booking = await Booking.findOne({ _id: id, orgId });
    if (!booking) throw httpError(404, "Booking not found.");
    if (booking.status !== "CHECKED_IN") throw httpError(409, "This user isn't currently checked in.");

    const now = new Date();
    const endAt = slot.istTimeToInstant(booking.date, booking.slotEnd);
    booking.actualCheckOut = now < endAt ? now : endAt;
    booking.status = "COMPLETED";
    await booking.save();
    return booking;
}

// ---- reads (console + ID box) ----------------------------------
async function listBookings({ orgId, dateStr, labUserId, referenceId, labId, includeCancelled }) {
    const query = { orgId };
    if (dateStr) query.date = slot.parseDateOnly(dateStr);
    if (labId) query.labId = labId;
    if (!includeCancelled) query.isActive = true;

    if (referenceId) {
        const umbrella = await Assignment.findOne({ orgId, referenceId });
        if (!umbrella) throw httpError(404, "No user found for that reference ID.");
        query.labUserId = umbrella.labUserId;
    } else if (labUserId) {
        query.labUserId = labUserId;
    }

    // keep statuses honest before reading
    await reconcileBookings({ orgId, ...(labId ? { labId } : {}), ...(query.labUserId ? { labUserId: query.labUserId } : {}) });

    return Booking.find(query)
        .sort({ date: 1, slotStart: 1 })
        .populate("labUserId", "name rollNumber department")
        .populate("assignmentId", "referenceId")
        .populate({ path: "systemId", select: "name labId", populate: { path: "labId", select: "name" } })
        .lean();
}

// ---- the walk-up "ID box" -------------------------------------
// Given a user's reference ID, return who they are, their approval
// window (with live status), and all their active bookings — the
// data the front desk needs to check them in and see what's next.
async function lookupByReferenceId(orgId, referenceId) {
    if (!referenceId || !String(referenceId).trim()) {
        throw httpError(400, "Enter a reference ID.");
    }
    const assignment = await Assignment.findOne({ orgId, referenceId: String(referenceId).trim() })
        .populate("labUserId", "name rollNumber department");
    if (!assignment) throw httpError(404, "No user found for that reference ID.");

    const theUser = assignment.labUserId?._id || assignment.labUserId;
    await reconcileBookings({ orgId, labUserId: theUser });

    const bookings = await Booking.find({
        orgId,
        labUserId: theUser,
        isActive: true,
    })
        .sort({ date: 1, slotStart: 1 })
        .populate({ path: "systemId", select: "name labId", populate: { path: "labId", select: "name" } })
        .lean();

    return {
        user: {
            labUserId: assignment.labUserId?._id || assignment.labUserId,
            name: assignment.labUserId?.name || "—",
            rollNumber: assignment.labUserId?.rollNumber || "—",
            department: assignment.labUserId?.department || "—",
        },
        assignment: {
            referenceId: assignment.referenceId,
            projectName: assignment.projectName,
            startDate: assignment.startDate,
            endDate: assignment.endDate,
            liveStatus: getStatus(assignment),
        },
        bookings: bookings.map((b) => ({
            bookingId: b._id,
            date: b.date,
            slotStart: b.slotStart,
            slotEnd: b.slotEnd,
            status: b.status,
            systemName: b.systemId?.name || "—",
            labName: b.systemId?.labId?.name || "—",
            actualCheckIn: b.actualCheckIn,
            actualCheckOut: b.actualCheckOut,
        })),
    };
}

module.exports = {
    DEFAULT_CONFIG,
    getEffectiveConfig,
    getAvailability,
    resolveUmbrellaForDate,
    createBooking,
    createRecurring,
    cancelBooking,
    reconcileBookings,
    checkIn,
    checkOut,
    listBookings,
    lookupByReferenceId,
};
