// ============================================================
// ROUTES: /api/labs   (Admin only)
// ------------------------------------------------------------
// Middleware chain: auth -> roleCheck(ADMIN) -> orgIsolation
// GET  /  -> list labs      POST /  -> create lab
// ============================================================
const express = require('express');
const {
  createLab,
  listLabs,
  getLabById,
  getLabDetails,
  updateLab,
  deleteLab,
} = require('../controllers/labController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const orgIsolation = require('../middleware/orgIsolation');

const router = express.Router();

router.use(auth, roleCheck('ADMIN'), orgIsolation);

router.get('/', listLabs);
router.get('/:id/details', getLabDetails);
router.get('/:id', getLabById);
router.post('/', createLab);
router.put('/:id', updateLab);
router.delete('/:id', deleteLab);

module.exports = router;
