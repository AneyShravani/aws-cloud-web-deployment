// ============================================================
// ROUTES: /api/assignments
// ------------------------------------------------------------
// GET  /my-requests      -> logged-in student requests (STUDENT only)
// POST /request          -> new user/student request (auth, upload)
// GET  /requests         -> pending requests (ADMIN only)
// POST /requests         -> new user request by admin (ADMIN only)
// POST /assign           -> assign system, returns Reference ID (ADMIN only)
// GET  /                 -> all assignments (ADMIN only)
// GET  /uploads/:filename -> serves HOD letter, org-scoped (ADMIN only)
// ============================================================

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

const auth = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const orgIsolation = require("../middleware/orgIsolation");
const upload = require("../middleware/upload");

const LabUser = require("../models/LabUser");

const {
    createRequest,
    listRequests,
    approveRequest,
    assignSystem,
    listAssignments,
    myRequests,
    updateAssignment,
    deleteAssignment,
    setOutcome,
} = require("../controllers/assignmentController");

// ============================================================
// STUDENT / PUBLIC USER ROUTES
// ============================================================

// Get all requests submitted by the logged-in student
router.get("/my-requests", auth, roleCheck("STUDENT"), myRequests);

// Submit a new system access request (Accessible by authenticated users/students)
router.post("/request", auth, roleCheck("STUDENT"), upload, createRequest);

// ============================================================
// ADMIN ONLY ROUTES (Enforces ADMIN role + Org Data Isolation)
// ============================================================

router.get("/requests", auth, roleCheck("ADMIN"), orgIsolation, listRequests);
router.post("/requests", auth, roleCheck("ADMIN"), orgIsolation, upload, createRequest);
router.post("/approve", auth, roleCheck("ADMIN"), orgIsolation, approveRequest); // v2: approve without pinning a machine
router.post("/assign", auth, roleCheck("ADMIN"), orgIsolation, assignSystem);    // legacy: kept during transition
router.get("/", auth, roleCheck("ADMIN"), orgIsolation, listAssignments);
router.patch("/:id/outcome", auth, roleCheck("ADMIN"), orgIsolation, setOutcome); // Utilization close-out
router.put("/:id", auth, roleCheck("ADMIN"), orgIsolation, updateAssignment);    // edit an approved user
router.delete("/:id", auth, roleCheck("ADMIN"), orgIsolation, deleteAssignment); // remove an approved user

// Serves an HOD letter file — ONLY to a logged-in admin whose orgId
// matches the LabUser record that owns this file.
router.get("/uploads/:filename", auth, roleCheck("ADMIN"), orgIsolation, async (req, res) => {
    try {
        const filePath = path.join(__dirname, "..", "uploads", req.params.filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: "File not found" });
        }

        const owner = await LabUser.findOne({
            hodLetterPath: `/uploads/${req.params.filename}`,
            orgId: req.user.orgId,
        });

        if (!owner) {
            return res.status(404).json({ success: false, message: "File not found" });
        }

        res.sendFile(filePath);
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error retrieving file" });
    }
});

module.exports = router;