const express = require('express');

const {
  deleteReport,
  downloadReportPdf,
  generateReport,
  getReport,
  getReports,
} = require('../controllers/reportController');
const auth = require('../middleware/auth');
const orgIsolation = require('../middleware/orgIsolation');
const roleCheck = require('../middleware/roleCheck');

const router = express.Router();

router.use(auth, roleCheck('ADMIN'), orgIsolation);

router.post('/generate', generateReport);
router.get('/', getReports);
router.get('/:id/pdf', downloadReportPdf);
router.get('/:id', getReport);
router.delete('/:id', deleteReport);

module.exports = router;
