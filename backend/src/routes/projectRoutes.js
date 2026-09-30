// ============================================================
// ROUTES: /api/projects  (project directory — continuation lookup)
// ------------------------------------------------------------
// Read-only, org-scoped (via req.user.orgId). Available to ADMIN
// (manual requests) and STUDENT (self-service), so both can find
// and continue/reopen an existing project instead of minting a new
// access ID.
// ============================================================
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { search, exact } = require('../controllers/projectController');

router.use(auth, roleCheck('ADMIN', 'STUDENT'));
router.get('/search', search);
router.get('/exact', exact);

module.exports = router;
