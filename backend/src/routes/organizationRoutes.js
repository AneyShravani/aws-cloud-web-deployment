const express = require('express');
const {
  createOrganization,
  listOrganizations,
  listPublicOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
} = require('../controllers/organizationController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const router = express.Router();

// Public route for student registration / signup dropdowns
router.get('/public', listPublicOrganizations);

// Super Admin restricted management routes
router.get('/', auth, roleCheck('SUPER_ADMIN'), listOrganizations);
router.get('/:id', auth, roleCheck('SUPER_ADMIN'), getOrganizationById);
router.post('/', auth, roleCheck('SUPER_ADMIN'), createOrganization);
router.put('/:id', auth, roleCheck('SUPER_ADMIN'), updateOrganization);
router.delete('/:id', auth, roleCheck('SUPER_ADMIN'), deleteOrganization);

module.exports = router;