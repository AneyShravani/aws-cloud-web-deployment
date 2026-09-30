// ============================================================
// ROUTES: /api/dashboard   (Admin only)
// ------------------------------------------------------------
// Middleware chain: auth -> roleCheck(ADMIN) -> orgIsolation
// GET /stats               -> aggregated counts
// GET /occupancy           -> per-lab occupancy table
// GET /reference/:refId    -> Reference ID status check
// GET /notifications       -> deadline alerts
// ============================================================

const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const orgIsolation = require('../middleware/orgIsolation');

const { getStats, getOccupancy, checkReferenceId } = require('../controllers/dashboardController');

router.use(auth, roleCheck('ADMIN'), orgIsolation);

router.get('/stats', getStats);
router.get('/occupancy', getOccupancy);
router.get('/reference/:refId', checkReferenceId);

module.exports = router;