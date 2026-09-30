// ============================================================
// ROUTES: /api/logs
// ------------------------------------------------------------
// GET  /reference/:referenceId -> fetch assignment details (ADMIN)
// POST /                       -> create a log entry (ADMIN)
// GET  /                       -> list all logs (ADMIN)
// ============================================================

const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const orgIsolation = require("../middleware/orgIsolation");

const { getByReferenceId, createLog, listLogs } = require("../controllers/logController");

router.get("/reference/:referenceId", auth, roleCheck("ADMIN"), orgIsolation, getByReferenceId);
router.post("/", auth, roleCheck("ADMIN"), orgIsolation, createLog);
router.get("/", auth, roleCheck("ADMIN"), orgIsolation, listLogs);

module.exports = router;