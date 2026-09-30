// ============================================================
// MODEL: Booking  (Slot-Booking Module — v2)  ** ATOMIC UNIT **
// ------------------------------------------------------------
// One reservation = one system × one date × one 1-hour slot,
// held by one user. Replaces the old "one system occupied for
// a whole date range" model. Occupancy everywhere is now
// DERIVED from these rows (dashboard, reports, logs), not from
// a permanent flag on System.
//
// Integrity:
//  - `date` is normalized to UTC-midnight of the calendar day
//    (services/slotService.parseDateOnly) so a day is a stable,
//    timezone-independent key.
//  - `slotStart`/`slotEnd` are denormalized ("09:00"/"10:00")
//    so history stays readable even if a lab's SlotConfig later
//    changes.
//  - `isActive` is true while the booking OCCUPIES its slot and
//    false once CANCELLED. The partial-unique index below uses
//    it to make double-booking physically impossible and
//    race-safe (a second concurrent writer gets a duplicate-key
//    error instead of a silent overlap).
// ============================================================

const mongoose = require("mongoose");

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const bookingSchema = new mongoose.Schema(
    {
        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        labId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lab",
            required: true,
        },
        systemId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "System",
            required: true,
        },
        labUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LabUser",
            required: true,
        },
        // The approval umbrella this booking belongs to (carries the
        // project window + the user's persistent referenceId).
        assignmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Assignment",
            required: true,
        },

        date: { type: Date, required: true },              // UTC-midnight of the calendar day
        slotStart: { type: String, required: true, match: TIME_RE }, // "09:00"
        slotEnd: { type: String, required: true, match: TIME_RE },   // "10:00"

        status: {
            type: String,
            enum: ["BOOKED", "CHECKED_IN", "COMPLETED", "NO_SHOW", "CANCELLED"],
            default: "BOOKED",
        },

        // true while the booking holds its slot; flipped false on cancel.
        // Drives the partial-unique index — see below.
        isActive: { type: Boolean, default: true },

        actualCheckIn: { type: Date, default: null },
        actualCheckOut: { type: Date, default: null },

        // true once this booking's NO_SHOW has already been counted as a strike
        // against the owner's account — so a no-show is only ever charged once,
        // no matter how many times reconcile/check-in runs over it.
        strikeApplied: { type: Boolean, default: false },

        bookedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AdminUser",
            required: true,
        },
    },
    { timestamps: true }
);

// ** THE GUARD RAIL ** — at most one ACTIVE booking may exist for a
// given system + date + slot. CANCELLED rows (isActive:false) are
// excluded, so a freed slot can be re-booked while history is kept.
bookingSchema.index(
    { systemId: 1, date: 1, slotStart: 1 },
    { unique: true, partialFilterExpression: { isActive: true } }
);

// Common read paths: the day grid (org+lab+date) and the user timeline.
bookingSchema.index({ orgId: 1, labId: 1, date: 1 });
bookingSchema.index({ labUserId: 1, date: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
