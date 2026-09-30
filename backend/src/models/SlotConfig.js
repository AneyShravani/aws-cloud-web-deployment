// ============================================================
// MODEL: SlotConfig  (Slot-Booking Module — v2)
// ------------------------------------------------------------
// The per-lab template that defines a bookable day:
//   open/close time, slot length, lunch/other breaks, and
//   which weekdays are bookable. Slots themselves are NEVER
//   stored — they are generated from this template on demand
//   (see services/slotService.generateSlots). Editing this
//   reshapes all FUTURE availability instantly; past bookings
//   keep their own denormalized times and are unaffected.
//
// One document per lab. A document with labId = null is the
// ORGANIZATION DEFAULT, used for any lab that has no config
// of its own.
// ============================================================

const mongoose = require("mongoose");

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:MM" 24h

const breakSchema = new mongoose.Schema(
    {
        start: { type: String, required: true, match: TIME_RE }, // "12:00"
        end: { type: String, required: true, match: TIME_RE },   // "13:00"
    },
    { _id: false }
);

const slotConfigSchema = new mongoose.Schema(
    {
        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },

        // null = organization default (fallback for labs without their own config)
        labId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lab",
            default: null,
        },

        openTime: { type: String, required: true, match: TIME_RE, default: "09:00" },
        closeTime: { type: String, required: true, match: TIME_RE, default: "16:00" },
        slotMinutes: { type: Number, required: true, default: 60, min: 15, max: 240 },

        breaks: { type: [breakSchema], default: () => [{ start: "12:00", end: "13:00" }] },

        // 0 = Sunday … 6 = Saturday. Default Mon–Sat.
        workingDays: { type: [Number], default: () => [1, 2, 3, 4, 5, 6] },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AdminUser",
            default: null,
        },
    },
    { timestamps: true }
);

// One config per lab per org (and exactly one org-default where labId = null).
slotConfigSchema.index({ orgId: 1, labId: 1 }, { unique: true });

module.exports = mongoose.model("SlotConfig", slotConfigSchema);
