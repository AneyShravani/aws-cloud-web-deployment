// ============================================================
// MODEL: Assignment  ** THE APPROVAL UMBRELLA + REFERENCE ID **
// ------------------------------------------------------------
// v2 (Slot-Booking): an Assignment is now the APPROVAL for a
// user — it says "this person is approved for this project
// during [startDate, endDate] and their access pass is this
// referenceId". The specific machines they use live on Booking
// rows (system × date × slot), NOT here.
//
// Fields: orgId, referenceId (unique — the user's persistent
// access ID), labUserId, projectName (purpose), startDate,
// endDate, status: ACTIVE | NEARING_EXPIRY | EXPIRED.
//
// `systemId` is LEGACY: it used to pin one permanently-occupied
// machine. It is kept nullable so old rows still read, but new
// approvals leave it empty — booking a machine is a per-slot
// action now.
// ============================================================

const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
    {
        labUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LabUser",
            required: true,
        }, // who this assignment belongs to

        systemId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "System",
            required: false,
            default: null,
        }, // LEGACY: permanently-assigned machine (pre slot-booking). Null for new approvals.

        projectName: { type: String, required: true },   // moved here from LabUser
        startDate: { type: Date, required: true },        // moved here from LabUser
        endDate: { type: Date, required: true },          // moved here from LabUser

        referenceId: {
            type: String,
            required: true,
            unique: true,
        }, // the Reference ID (access ID) — PERSISTS across continuations/reopens

        status: {
            type: String,
            enum: ["ACTIVE", "NEARING_EXPIRY", "EXPIRED"],
            default: "ACTIVE",
        }, // time-based; flipped by referenceIdService / deadlineChecker

        // ---- Project identity (the permanent, unique key that owns the ID) ----
        // nameKey = normalized projectName (lowercase-hyphen). Unique per org is
        // enforced in the service layer (not a DB index, to avoid breaking any
        // pre-existing duplicate names). Drives the type-to-continue search.
        nameKey: { type: String, default: "", index: true },

        // ---- Close-out outcome (admin sets in Utilization after expiry) ----
        // NONE while running; COMPLETED (done, maybe deployed) closes it for
        // everyday work; INCOMPLETE keeps it continuable under the same ID.
        outcome: {
            type: String,
            enum: ["NONE", "COMPLETED", "INCOMPLETE"],
            default: "NONE",
        },
        outcomeNote: { type: String, default: "" },
        outcomeAt: { type: Date, default: null },
        liveUrl: { type: String, default: "" },    // set when COMPLETED + deployed
        deployed: { type: Boolean, default: false }, // is the deployment currently live?
        toolName: { type: String, default: "" },    // e.g. "Claude Code", "ChatGPT"

        // kind of the CURRENT tenure
        kind: {
            type: String,
            enum: ["INITIAL", "CONTINUATION", "MAINTENANCE"],
            default: "INITIAL",
        },

        // Every past tenure, archived on continuation/reopen so a project's whole
        // lifetime (incl. handoffs between students) is tracked forever.
        history: [
            {
                labUserId: { type: mongoose.Schema.Types.ObjectId, ref: "LabUser" },
                name: String,
                rollNumber: String,
                startDate: Date,
                endDate: Date,
                outcome: String,
                liveUrl: String,
                hodLetterPath: String,
                kind: String,
                closedAt: Date,
            },
        ],

        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
    },
    { timestamps: true }
);

assignmentSchema.index({ orgId: 1, nameKey: 1 });

module.exports = mongoose.model("Assignment", assignmentSchema);