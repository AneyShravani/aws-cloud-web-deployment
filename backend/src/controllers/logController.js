// ============================================================
// CONTROLLER: logController
// Handles Reference ID lookup, log entry creation, and listing logs.
// Enforces Org Data Isolation and Access Control for EXPIRED assignments.
// ============================================================

const Assignment = require("../models/Assignment");
const Log = require("../models/Log");
const { getStatus } = require("../services/referenceIdService");

// GET /api/logs/reference/:referenceId
// Fetches Assignment + populated LabUser and System details
async function getByReferenceId(req, res, next) {
    try {
        const orgId = req.user.orgId; // Enforce Org Isolation

        const assignment = await Assignment.findOne({
            referenceId: req.params.referenceId,
            orgId,
        })
            .populate("labUserId", "name rollNumber department")
            .populate({
                path: "systemId",
                select: "name labId",
                populate: { path: "labId", select: "name" },
            });

        if (!assignment) {
            return res.status(404).json({ success: false, message: "Reference ID not found." });
        }

        res.json({
            success: true,
            data: {
                referenceId: assignment.referenceId,
                assignmentId: assignment._id,
                name: assignment.labUserId?.name || "—",
                rollNumber: assignment.labUserId?.rollNumber || "—",
                department: assignment.labUserId?.department || "—",
                projectName: assignment.projectName,
                labName: assignment.systemId?.labId?.name || "—",
                systemName: assignment.systemId?.name || "—",
                liveStatus: getStatus(assignment), // Evaluates live deadline
            },
        });
    } catch (err) {
        next(err);
    }
}

// POST /api/logs
// Creates a visit log record (Only for non-EXPIRED Reference IDs)
async function createLog(req, res, next) {
    try {
        const orgId = req.user.orgId;
        const { referenceId, loginTime, logoutTime } = req.body;

        if (!referenceId || !loginTime || !logoutTime) {
            return res.status(400).json({
                success: false,
                message: "referenceId, loginTime, and logoutTime are all required.",
            });
        }

        const assignment = await Assignment.findOne({ referenceId, orgId });
        if (!assignment) {
            return res.status(404).json({ success: false, message: "Reference ID not found." });
        }

        // BACKEND SECURITY CHECK: Deny logging if assignment is expired
        const liveStatus = getStatus(assignment);
        if (liveStatus === "EXPIRED") {
            return res.status(403).json({
                success: false,
                message: "This Reference ID has expired. Access denied — cannot log a visit.",
            });
        }

        const log = await Log.create({
            referenceId,
            assignmentId: assignment._id,
            orgId,
            loginTime,
            logoutTime,
            createdBy: req.user.id,
        });

        res.status(201).json({ success: true, data: log });
    } catch (err) {
        next(err);
    }
}

// GET /api/logs
// Retrieves all recorded access logs for the organization
async function listLogs(req, res, next) {
    try {
        const orgId = req.user.orgId;

        const logs = await Log.find({ orgId })
            .populate({
                path: "assignmentId",
                select: "projectName labUserId systemId",
                populate: [
                    { path: "labUserId", select: "name" },
                    { path: "systemId", select: "name" },
                ],
            })
            .sort({ createdAt: -1 });

        const formattedLogs = logs.map((l) => {
            const obj = l.toObject();
            return {
                ...obj,
                name: obj.assignmentId?.labUserId?.name || "—",
                projectName: obj.assignmentId?.projectName || "—",
                systemName: obj.assignmentId?.systemId?.name || "—",
            };
        });

        res.json({ success: true, data: formattedLogs });
    } catch (err) {
        next(err);
    }
}

module.exports = { getByReferenceId, createLog, listLogs };