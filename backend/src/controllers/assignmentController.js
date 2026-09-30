// ============================================================
// CONTROLLER: assignmentController (core workflow, Sec 4)
// ============================================================

const LabUser = require("../models/LabUser");
const AdminUser = require("../models/AdminUser");
const System = require("../models/System");
const Assignment = require("../models/Assignment");
const Booking = require("../models/Booking");
const { generateReferenceId, getStatus } = require("../services/referenceIdService");
const { sendApprovalEmail } = require("../services/emailService");
const { createNotification } = require("../services/notificationService");
const { findOrCreateAccount } = require("../services/userService");
const { normalizeProjectName, isValidProjectName, EXAMPLE } = require("../utils/projectName");

// Helper to strictly format dates as YYYY-MM-DD
function formatDate(dateVal) {
    if (!dateVal) return "--";
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? "--" : d.toISOString().split("T")[0];
}

// POST /api/assignments/request (STUDENT) or /requests (ADMIN)
async function createRequest(req, res, next) {
    try {
        const isStudent = req.user.role === "STUDENT";
        const orgId = req.user.orgId; // NEVER trust req.body for orgId

        if (!req.file) {
            return res.status(400).json({ message: "HOD letter file is required." });
        }

        const { projectName, startDate, endDate, continueProjectId } = req.body;

        // ---- Resolve the project this request targets ----
        // If continueProjectId is set, this request CONTINUES/REOPENS an existing
        // project (its access ID is reused on approval) and inherits its exact
        // name. Otherwise it's a NEW project: the name must be valid and unique.
        let continueTarget = null;
        let normalizedName;
        if (continueProjectId) {
            continueTarget = await Assignment.findOne({ _id: continueProjectId, orgId });
            if (!continueTarget) {
                return res.status(404).json({ message: "The project you're trying to continue was not found." });
            }
            normalizedName = continueTarget.nameKey || normalizeProjectName(continueTarget.projectName);
        } else {
            normalizedName = normalizeProjectName(projectName);
            if (!isValidProjectName(normalizedName)) {
                return res.status(400).json({ message: `Project name must be lowercase words joined by hyphens, e.g. "${EXAMPLE}".` });
            }
            const clash = await Assignment.findOne({ orgId, nameKey: normalizedName });
            if (clash) {
                return res.status(409).json({ message: `A project named "${normalizedName}" already exists. Pick it from the dropdown to continue it, or choose a different name.` });
            }
        }

        let labUserData;
        if (isStudent) {
            const student = await AdminUser.findById(req.user.id);
            labUserData = {
                name: student.name,
                rollNumber: student.rollNumber || student.rollNo,
                department: student.department,
                userType: student.userType || "student",
                studentId: student._id,
                projectName: normalizedName,
                startDate,
                endDate,
            };
        } else {
            // Manual request (admin walk-in). We link it to a login ACCOUNT by
            // email: found → reuse it; not found → create one + email creds
            // (so the person can self-serve next time, and approval mail reaches them).
            const { name, rollNumber, department, userType, email } = req.body;
            if (!email) {
                return res.status(400).json({ message: "Email is required to create a manual request." });
            }
            const { account } = await findOrCreateAccount(orgId, { name, email, rollNumber, department, userType });
            labUserData = {
                name: name || account.name,
                rollNumber: rollNumber || account.rollNumber,
                department: department || account.department,
                userType: userType || account.userType || "student",
                studentId: account._id, // link to the login account
                projectName: normalizedName,
                startDate,
                endDate,
            };
        }

        const labUser = await LabUser.create({
            ...labUserData,
            hodLetterPath: `/uploads/${req.file.filename}`,
            orgId,
            source: isStudent ? 'student' : 'manual', // student self-service vs admin walk-in entry
            status: 'PENDING',
            continueProjectId: continueTarget ? continueTarget._id : null,
        });

        res.status(201).json({ success: true, data: labUser });
    } catch (err) {
        next(err);
    }
}

// GET /api/assignments/requests (ADMIN ONLY) — pending = not yet approved.
// Keyed off LabUser.status (not the Assignment pointer, which now moves between
// holders on continuation/reopen). $nin covers legacy rows with no status set.
async function listRequests(req, res, next) {
    try {
        const orgId = req.user.orgId;
        const pending = await LabUser.find({ orgId, status: { $nin: ["APPROVED", "REJECTED"] } })
            .sort({ createdAt: -1 });

        // annotate whether each is a continuation/reopen of an existing project
        const continueIds = pending.map((u) => u.continueProjectId).filter(Boolean);
        const targets = continueIds.length
            ? await Assignment.find({ _id: { $in: continueIds } }).select("referenceId projectName outcome")
            : [];
        const targetById = new Map(targets.map((t) => [t._id.toString(), t]));

        const data = pending.map((u) => {
            const obj = u.toObject();
            const t = u.continueProjectId ? targetById.get(u.continueProjectId.toString()) : null;
            obj.continuation = t
                ? {
                      referenceId: t.referenceId,
                      projectName: t.projectName,
                      mode: t.outcome === "COMPLETED" ? "reopen" : "continue",
                  }
                : null;
            return obj;
        });

        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
}

// POST /api/assignments/assign (ADMIN ONLY)
async function assignSystem(req, res, next) {
    try {
        const orgId = req.user.orgId;
        const { labUserId, systemId, projectName, startDate, endDate } = req.body;

        if (!labUserId || !systemId || !projectName || !startDate || !endDate) {
            return res.status(400).json({
                message: "labUserId, systemId, projectName, startDate, and endDate are all required.",
            });
        }
        if (new Date(endDate) <= new Date(startDate)) {
            return res.status(400).json({ message: "endDate must be after startDate." });
        }

        // atomically claim an AVAILABLE system (race-condition safe)
        const claimedSystem = await System.findOneAndUpdate(
            { _id: systemId, orgId, status: "AVAILABLE" },
            { $set: { status: "OCCUPIED" } },
            { new: true }
        );

        if (!claimedSystem) {
            return res.status(409).json({
                message: "System is no longer available. It may have just been assigned to another user.",
            });
        }

        const labUser = await LabUser.findOne({ _id: labUserId, orgId });
        if (!labUser) {
            await System.findOneAndUpdate({ _id: systemId, orgId }, { status: "AVAILABLE" });
            return res.status(404).json({ message: "LabUser not found in this organization." });
        }

        const referenceId = await generateReferenceId(orgId);

        const assignment = await Assignment.create({
            labUserId,
            systemId,
            projectName,
            startDate,
            endDate,
            referenceId,
            status: "ACTIVE",
            orgId,
        });

        // student's login email lives on AdminUser, not LabUser
        try {
            let studentEmail = null;
            if (labUser.studentId) {
                const student = await AdminUser.findById(labUser.studentId);
                studentEmail = student?.email;
            }
            if (studentEmail) {
                await sendApprovalEmail({
                    studentEmail,
                    studentName: labUser.name,
                    projectName: assignment.projectName,
                    systemName: claimedSystem.name,
                    referenceId: assignment.referenceId,
                    startDate: assignment.startDate,
                    endDate: assignment.endDate,
                });
            }
        } catch (emailErr) {
            console.error("Failed to send approval email:", emailErr);
        }

        try {
            await createNotification(
                labUser._id,
                orgId,
                assignment._id,
                "Request Approved",
                `Your request for "${projectName}" has been approved. Reference ID: ${assignment.referenceId}`
            );
        } catch (notifErr) {
            console.error("Failed to save student notification:", notifErr);
        }

        res.status(201).json({
            message: "System assigned successfully.",
            referenceId: assignment.referenceId,
            assignment,
        });
    } catch (err) {
        next(err);
    }
}

// POST /api/assignments/approve (ADMIN ONLY) — v2 slot-booking
// ------------------------------------------------------------
// Approves a pending request WITHOUT pinning a machine. Creates
// the "umbrella" Assignment that carries the project window +
// the user's persistent Reference ID (their access pass). The
// actual machines are booked per-slot afterwards via /api/bookings.
async function approveRequest(req, res) {
    try {
        const orgId = req.user.orgId;
        const { labUserId, startDate, endDate } = req.body;

        if (!labUserId) {
            return res.status(400).json({ success: false, message: "labUserId is required." });
        }

        const labUser = await LabUser.findOne({ _id: labUserId, orgId });
        if (!labUser) {
            return res.status(404).json({ success: false, message: "User not found in this organization." });
        }

        // Window defaults to what the user requested; admin may override the dates.
        // The project NAME is fixed (normalized at request time / inherited on continue).
        const window = {
            startDate: startDate || labUser.startDate,
            endDate: endDate || labUser.endDate,
        };
        if (!labUser.projectName || !window.startDate || !window.endDate) {
            return res.status(400).json({ success: false, message: "projectName, startDate and endDate are required." });
        }
        if (new Date(window.endDate) <= new Date(window.startDate)) {
            return res.status(400).json({ success: false, message: "endDate must be after startDate." });
        }

        let assignment;
        let kindResult;

        if (labUser.continueProjectId) {
            // ---- CONTINUE / REOPEN: reuse the existing project's access ID ----
            const project = await Assignment.findOne({ _id: labUser.continueProjectId, orgId });
            if (!project) {
                return res.status(404).json({ success: false, message: "The project being continued was not found." });
            }

            // Archive the outgoing tenure (its holder = the project's current labUserId).
            let outgoing = null;
            if (project.labUserId) outgoing = await LabUser.findById(project.labUserId);
            project.history.push({
                labUserId: project.labUserId,
                name: outgoing?.name,
                rollNumber: outgoing?.rollNumber,
                startDate: project.startDate,
                endDate: project.endDate,
                outcome: project.outcome,
                liveUrl: project.liveUrl,
                hodLetterPath: outgoing?.hodLetterPath,
                kind: project.kind,
                closedAt: new Date(),
            });

            // A COMPLETED project reopens for MAINTENANCE; anything else CONTINUES.
            kindResult = project.outcome === "COMPLETED" ? "MAINTENANCE" : "CONTINUATION";

            // Reassign to the new holder + fresh window; access ID (referenceId) stays.
            project.labUserId = labUser._id;
            project.projectName = labUser.projectName;
            project.startDate = window.startDate;
            project.endDate = window.endDate;
            project.status = "ACTIVE";
            project.outcome = "NONE";
            project.outcomeNote = "";
            project.outcomeAt = null;
            project.liveUrl = "";
            project.kind = kindResult;
            await project.save();
            assignment = project;
        } else {
            // ---- NEW project: mint a fresh access ID ----
            // Idempotent for THIS request's labUser (double-click safety).
            const existing = await Assignment.findOne({ orgId, labUserId });
            if (existing) {
                labUser.status = "APPROVED";
                await labUser.save();
                return res.status(200).json({
                    success: true,
                    message: "This request is already approved.",
                    referenceId: existing.referenceId,
                    assignment: existing,
                });
            }
            // Uniqueness guard (a project with this name may have appeared meanwhile).
            const clash = await Assignment.findOne({ orgId, nameKey: labUser.projectName });
            if (clash) {
                return res.status(409).json({ success: false, message: `A project named "${labUser.projectName}" already exists. Continue it instead of approving a new one.` });
            }

            const referenceId = await generateReferenceId(orgId);
            assignment = await Assignment.create({
                labUserId,
                projectName: labUser.projectName,
                nameKey: labUser.projectName,
                startDate: window.startDate,
                endDate: window.endDate,
                referenceId,
                status: "ACTIVE",
                outcome: "NONE",
                kind: "INITIAL",
                orgId,
            });
            kindResult = "INITIAL";
        }

        // Mark the request handled so it leaves the pending queue.
        labUser.status = "APPROVED";
        await labUser.save();

        const verb = kindResult === "MAINTENANCE" ? "reopened for maintenance"
            : kindResult === "CONTINUATION" ? "continued" : "approved";

        // Notify the student (best-effort; never blocks approval).
        try {
            let studentEmail = null;
            if (labUser.studentId) {
                const student = await AdminUser.findById(labUser.studentId);
                studentEmail = student?.email;
            }
            if (studentEmail) {
                await sendApprovalEmail({
                    studentEmail,
                    studentName: labUser.name,
                    projectName: assignment.projectName,
                    systemName: "Booked per slot at the lab desk",
                    referenceId: assignment.referenceId,
                    startDate: assignment.startDate,
                    endDate: assignment.endDate,
                });
            }
        } catch (emailErr) {
            console.error("Failed to send approval email:", emailErr);
        }

        try {
            await createNotification(
                labUser._id,
                orgId,
                assignment._id,
                "Request Approved",
                `Your project "${assignment.projectName}" was ${verb}. Access ID: ${assignment.referenceId}. Book your lab slots at the desk.`
            );
        } catch (notifErr) {
            console.error("Failed to save student notification:", notifErr);
        }

        return res.status(201).json({
            success: true,
            message: `Request ${verb}.`,
            referenceId: assignment.referenceId,
            kind: kindResult,
            assignment,
        });
    } catch (err) {
        console.error("approveRequest error:", err);
        return res.status(500).json({ success: false, message: "Server error approving request." });
    }
}

// GET /api/assignments (ADMIN ONLY)
// GET /api/assignments (ADMIN ONLY)
async function listAssignments(req, res, next) {
    try {
        const orgId = req.user.orgId;

        const assignments = await Assignment.find({ orgId })
            .populate("labUserId", "name rollNumber department userType hodLetterPath source")
            .populate({
                path: "systemId",
                select: "name labId",
                populate: { path: "labId", select: "name" },
            })
            .sort({ createdAt: -1 });

        const withLiveStatus = assignments.map((a) => {
            const obj = a.toObject();
            return {
                ...obj,
                name: obj.labUserId?.name || "—",
                rollNumber: obj.labUserId?.rollNumber || "",
                department: obj.labUserId?.department || "",
                userType: obj.labUserId?.userType || "",
                hodLetterPath: obj.labUserId?.hodLetterPath || null,
                source: obj.labUserId?.source || null,
                labName: obj.systemId?.labId?.name || "—",
                systemName: obj.systemId?.name || "—",
                liveStatus: getStatus(a),
                // project lifecycle (close-out outcome + continuation trail)
                outcome: obj.outcome || "NONE",
                outcomeNote: obj.outcomeNote || "",
                liveUrl: obj.liveUrl || "",
                deployed: Boolean(obj.deployed),
                toolName: obj.toolName || "",
                kind: obj.kind || "INITIAL",
                historyCount: (obj.history || []).length,
            };
        });

        res.json({ success: true, data: withLiveStatus });
    } catch (err) {
        next(err);
    }
}

// GET /api/assignments/my-requests (STUDENT ONLY)
async function myRequests(req, res, next) {
    try {
        const studentId = req.user.id;
        const orgId = req.user.orgId;

        const labUsers = await LabUser.find({ studentId, orgId }).sort({ createdAt: -1 });
        const labUserIds = labUsers.map((u) => u._id);
        const idSet = new Set(labUserIds.map((id) => id.toString()));

        // Projects this student currently holds OR held in the past (in history).
        const assignments = await Assignment.find({
            orgId,
            $or: [{ labUserId: { $in: labUserIds } }, { "history.labUserId": { $in: labUserIds } }],
        }).populate({
            path: "systemId",
            select: "name labId",
            populate: { path: "labId", select: "name" },
        });

        const currentByLabUser = new Map();   // labUser is the CURRENT holder
        const supersededByLabUser = new Map(); // labUser was a PAST tenure (in history)
        for (const a of assignments) {
            if (a.labUserId && idSet.has(a.labUserId.toString())) {
                currentByLabUser.set(a.labUserId.toString(), a);
            }
            for (const h of a.history || []) {
                if (h.labUserId && idSet.has(h.labUserId.toString())) {
                    supersededByLabUser.set(h.labUserId.toString(), a);
                }
            }
        }

        const result = labUsers.map((u) => {
            const key = u._id.toString();
            const current = currentByLabUser.get(key);
            const superseded = supersededByLabUser.get(key);
            const submittedOn = formatDate(u.createdAt);
            const base = {
                id: u._id,
                projectName: u.projectName || "--",
                startDate: formatDate(u.startDate),
                endDate: formatDate(u.endDate),
                submittedOn,
                hodLetterPath: u.hodLetterPath || null,
            };

            if (current) {
                return {
                    ...base,
                    projectName: current.projectName || base.projectName,
                    startDate: formatDate(current.startDate),
                    endDate: formatDate(current.endDate),
                    status: getStatus(current), // ACTIVE | NEARING_EXPIRY | EXPIRED
                    referenceId: current.referenceId,
                    assignedSystem: current.systemId
                        ? `${current.systemId.name} (${current.systemId.labId?.name || ""})`
                        : "Unassigned",
                };
            }
            if (superseded) {
                // this tenure was renewed/continued under the same access ID
                return {
                    ...base,
                    status: "RENEWED",
                    referenceId: superseded.referenceId,
                    assignedSystem: "Unassigned",
                };
            }
            return {
                ...base,
                status: u.status === "REJECTED" ? "REJECTED" : "PENDING",
                referenceId: "--",
                assignedSystem: "Unassigned",
            };
        });

        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

// PUT /api/assignments/:id (ADMIN ONLY) — edit an approved user
// ------------------------------------------------------------
// Updates the approval window (project / dates) on the Assignment
// AND the person's profile (name / roll / department / user type)
// on the linked LabUser. Org-scoped.
async function updateAssignment(req, res, next) {
    try {
        const orgId = req.user.orgId;
        const { id } = req.params;
        const { name, rollNumber, department, userType, projectName, startDate, endDate } = req.body;

        const assignment = await Assignment.findOne({ _id: id, orgId });
        if (!assignment) {
            return res.status(404).json({ success: false, message: "Approved user not found." });
        }

        const nextStart = startDate ?? assignment.startDate;
        const nextEnd = endDate ?? assignment.endDate;
        if (new Date(nextEnd) <= new Date(nextStart)) {
            return res.status(400).json({ success: false, message: "End date must be after start date." });
        }

        if (projectName !== undefined) assignment.projectName = projectName;
        if (startDate !== undefined) assignment.startDate = startDate;
        if (endDate !== undefined) assignment.endDate = endDate;
        await assignment.save();

        // keep the requester profile + its copy of the window in sync
        const labUser = await LabUser.findOne({ _id: assignment.labUserId, orgId });
        if (labUser) {
            if (name !== undefined) labUser.name = name;
            if (rollNumber !== undefined) labUser.rollNumber = rollNumber;
            if (department !== undefined) labUser.department = department;
            if (userType !== undefined) labUser.userType = userType;
            if (projectName !== undefined) labUser.projectName = projectName;
            if (startDate !== undefined) labUser.startDate = startDate;
            if (endDate !== undefined) labUser.endDate = endDate;
            await labUser.save();
        }

        return res.json({ success: true, message: "Approved user updated.", assignment });
    } catch (err) {
        next(err);
    }
}

// DELETE /api/assignments/:id (ADMIN ONLY) — remove an approved user
// ------------------------------------------------------------
// Fully removes the approval: frees any legacy pinned system, deletes
// the user's bookings, then deletes the Assignment and the LabUser.
async function deleteAssignment(req, res, next) {
    try {
        const orgId = req.user.orgId;
        const { id } = req.params;

        const assignment = await Assignment.findOne({ _id: id, orgId });
        if (!assignment) {
            return res.status(404).json({ success: false, message: "Approved user not found." });
        }

        const labUserId = assignment.labUserId;

        // free a legacy permanently-pinned machine, if any
        if (assignment.systemId) {
            await System.findOneAndUpdate({ _id: assignment.systemId, orgId }, { status: "AVAILABLE" });
        }

        // remove the user's slot bookings, then the approval + the person
        await Booking.deleteMany({ orgId, labUserId });
        await Assignment.deleteOne({ _id: id, orgId });
        if (labUserId) await LabUser.deleteOne({ _id: labUserId, orgId });

        return res.json({ success: true, message: "Approved user removed." });
    } catch (err) {
        next(err);
    }
}

// PATCH /api/assignments/:id/outcome (ADMIN) — the Utilization close-out.
// Marks a project's result once its window is done:
//   COMPLETED  -> closes it for everyday work (reopen = maintenance later)
//   INCOMPLETE -> stays continuable under the same access ID
//   NONE       -> clears a mistaken mark
async function setOutcome(req, res, next) {
    try {
        const orgId = req.user.orgId;
        const { id } = req.params;
        const { outcome, liveUrl, note, toolName, deployed } = req.body;

        if (!["COMPLETED", "INCOMPLETE", "NONE"].includes(outcome)) {
            return res.status(400).json({ success: false, message: "outcome must be COMPLETED, INCOMPLETE or NONE." });
        }

        const assignment = await Assignment.findOne({ _id: id, orgId });
        if (!assignment) {
            return res.status(404).json({ success: false, message: "Project not found." });
        }

        assignment.outcome = outcome;
        assignment.outcomeNote = (note || "").trim();
        assignment.outcomeAt = outcome === "NONE" ? null : new Date();
        assignment.toolName = (toolName || "").trim();
        // live URL + deployment only make sense for a completed project
        assignment.liveUrl = outcome === "COMPLETED" ? (liveUrl || "").trim() : "";
        assignment.deployed = outcome === "COMPLETED" ? Boolean(deployed) : false;
        await assignment.save();

        return res.json({ success: true, message: "Outcome updated.", assignment });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    createRequest,
    listRequests,
    approveRequest,
    assignSystem,
    listAssignments,
    myRequests,
    updateAssignment,
    deleteAssignment,
    setOutcome,
};