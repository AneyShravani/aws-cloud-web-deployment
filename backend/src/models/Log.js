// ============================================================
// MODEL: Log  (new module — daily lab attendance/history)
// ------------------------------------------------------------
// One row per login/logout entry. Admin looks up an existing
// Assignment by referenceId, then logs a visit against it.
// Does NOT duplicate user/project/system data — those are
// fetched live from Assignment/LabUser/System/Lab on read.
// Only login/logout/date/who-logged-it live here.
// ============================================================

const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
    {
        referenceId: {
            type: String,
            required: true,
        }, // the ID admin typed in — same string as Assignment.referenceId

        assignmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Assignment",
            required: true,
        }, // links back to the exact assignment this visit belongs to

        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        }, // NEVER trust req.body for this — always req.user.orgId

        loginTime: {
            type: String,
            required: true,
        }, // manually entered by admin, e.g. "12:00 PM"

        logoutTime: {
            type: String,
            required: true,
        }, // manually entered by admin, e.g. "4:00 PM"

        date: {
            type: Date,
            default: Date.now,
        }, // defaults to the day this log was created

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AdminUser",
            required: true,
        }, // which admin entered this log — req.user.id from JWT
    },
    { timestamps: true }
);

module.exports = mongoose.model("Log", logSchema);