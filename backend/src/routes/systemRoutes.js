// ============================================================
// ROUTES: /api/systems   (Admin only)
// ------------------------------------------------------------
// Middleware chain: auth -> roleCheck(ADMIN) -> orgIsolation
// orgIsolation attaches the trusted req.orgId from the JWT and
// strips any client-supplied orgId. Controllers also filter every
// query by req.user.orgId directly (defence in depth).
// GET  /lab/:labId       -> systems of a lab
// GET  /available/:labId -> free systems in a lab
// GET  /occupancy/:labId -> occupancy count for a lab
// POST /                 -> add N systems to a lab
// PUT  /:systemId        -> update one system
// DELETE /:systemId      -> delete one system
// ============================================================

const express = require("express"); // web framework
const router = express.Router(); // mini router for this module
const auth = require("../middleware/auth"); // verifies JWT, sets req.user
const roleCheck = require("../middleware/roleCheck"); // checks req.user.role matches allowed roles
const orgIsolation = require("../middleware/orgIsolation"); // trusted req.orgId from JWT, strips client orgId

const {
    addSystems,
    listByLab,
    listAvailable,
    getOccupancyForLab,
    updateSystem,    // NEW: import the update function you just added to the controller
    deleteSystem,    // NEW: import the delete function you just added to the controller
} = require("../controllers/systemController"); // import all controller functions

router.use(auth, roleCheck("ADMIN"), orgIsolation); // valid login + ADMIN role + org isolation on every route below

router.post("/", addSystems);
router.get("/lab/:labId", listByLab);
router.get("/available/:labId", listAvailable);
router.get("/occupancy/:labId", getOccupancyForLab);
router.put("/:systemId", updateSystem);    // FIX (Copilot LOW): comment corrected — this only edits a system's NAME, not status. Controller intentionally excludes status here.
router.delete("/:systemId", deleteSystem); // NEW: remove a system

module.exports = router;