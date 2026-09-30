// ============================================================
// MODEL: Notification
// ------------------------------------------------------------
// System notifications for admins & students.
// Fields: orgId, userId (optional), assignmentId (optional), 
//         title, message, isRead, createdAt.
// ============================================================

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // or LabUser depending on your user model
            required: false,
        },
        assignmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Assignment",
            required: false,
        },
        title: {
            type: String,
            required: true,
            default: "Notification",
        },
        message: {
            type: String,
            required: true,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);