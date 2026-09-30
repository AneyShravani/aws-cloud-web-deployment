// ============================================================
// ROUTES: /api/slot-config   (Slot-Booking Module — v2)
// ------------------------------------------------------------
// Admin-only + org-isolated. Chain: auth → ADMIN → orgIsolation.
//   GET /:labId   -> effective config + generated slots
//   PUT /:labId   -> upsert this lab's config ("default" = org default)
// ============================================================

const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const orgIsolation = require("../middleware/orgIsolation");

const { getConfig, upsertConfig } = require("../controllers/slotConfigController");

router.use(auth, roleCheck("ADMIN"), orgIsolation);

router.get("/:labId", getConfig);
router.put("/:labId", upsertConfig);

module.exports = router;
