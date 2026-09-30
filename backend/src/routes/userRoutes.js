// ============================================================
// ROUTES: /api/users   (Admin only — User Management)
// ------------------------------------------------------------
// GET    /            -> list accounts in the admin's org
// GET    /lookup?email -> find one account by email (autofill)
// POST   /            -> create account + email credentials
// POST   /:id/resend  -> regenerate + re-email credentials
// PATCH  /:id/active  -> activate / deactivate
// POST   /attach-email -> give a legacy account-less user an email (creates login)
// ============================================================
const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const {
  createUser, listUsers, lookupUser, resendCredentials, setActive, attachEmail,
} = require('../controllers/userController');

const router = express.Router();

router.use(auth, roleCheck('ADMIN'));

router.get('/', listUsers);
router.get('/lookup', lookupUser);
router.post('/', createUser);
router.post('/attach-email', attachEmail);
router.post('/:id/resend', resendCredentials);
router.patch('/:id/active', setActive);

module.exports = router;
