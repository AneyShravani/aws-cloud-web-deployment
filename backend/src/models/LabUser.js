// ============================================================
// MODEL: LabUser  (the requester — Module 3.7)
// ------------------------------------------------------------
// A student / faculty / HOD / HR / employee who requests
// a system. Fields: orgId, name, rollNumber, department,
// userType, hodLetterPath (uploaded document in /uploads),
// projectName, startDate, endDate.
// ============================================================

const mongoose = require("mongoose");

const labUserSchema = new mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AdminUser",
            default: null,
        },
        name: { type: String, required: true },               // requester's name
        rollNumber: { type: String, required: true },          // student/employee roll no
        department: { type: String, required: true },          // department

        userType: {
            type: String,
            enum: ["student", "faculty", "hod", "hr", "employee"],
            required: true,
        },

        projectName: { type: String, required: true },         // project purpose (normalized lowercase-hyphen)
        startDate: { type: Date, required: true },            // duration start
        endDate: { type: Date, required: true },              // duration end

        // Request lifecycle — decouples the pending queue from the Assignment
        // pointer (which now moves between holders on continuation/reopen).
        status: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED"],
            default: "PENDING",
        },

        // If set, this request CONTINUES / REOPENS an existing project (that
        // Assignment) instead of creating a new one — its access ID is reused.
        continueProjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Assignment",
            default: null,
        },

        // how the request was created:
        //  'student' -> a logged-in student raised it from their account
        //  'manual'  -> an admin entered it for a walk-in (letter in hand)
        source: {
            type: String,
            enum: ['student', 'manual'],
            default: 'student',
        },

        hodLetterPath: { type: String, required: true },        // uploaded HOD letter file path

        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("LabUser", labUserSchema);