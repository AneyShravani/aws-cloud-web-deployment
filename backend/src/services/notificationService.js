// ============================================================
// SERVICE: notificationService
// ------------------------------------------------------------
// - createNotification(userId, orgId, assignmentId, title, message)
//   Saves a notification to the database for a user/student.
// - createDeadlineAlert(assignment)
//   Saves deadline approaching alerts for admin panel.
// ============================================================

const Notification = require("../models/Notification");

/**
 * Saves a notification to the database for a user/student
 */
async function createNotification(userId, orgId, assignmentId, title, message) {
    try {
        const notification = await Notification.create({
            userId,
            orgId,
            assignmentId,
            title,
            message,
            isRead: false,
        });
        return notification;
    } catch (err) {
        console.error("Failed to create notification:", err);
        return null; // Fail silently so main assignment workflow isn't interrupted
    }
}

/**
 * Creates deadline approaching alert for admin panel
 */
async function createDeadlineAlert(assignment) {
    try {
        const existing = await Notification.findOne({
            assignmentId: assignment._id,
            orgId: assignment.orgId,
        });

        if (existing) return existing; // Avoid duplicate alerts

        return await Notification.create({
            orgId: assignment.orgId,
            assignmentId: assignment._id,
            title: "Deadline Approaching",
            message: `Assignment reference ID ${assignment.referenceId} is nearing its deadline.`,
            isRead: false,
        });
    } catch (err) {
        console.error("Failed to create deadline alert:", err);
        return null;
    }
}

module.exports = {
    createNotification,
    createDeadlineAlert,
};