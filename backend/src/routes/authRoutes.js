const express = require('express');
const {
  login,
  resetPassword,
  forgotPassword,
  verifyForgotPasswordOtp,
  forgotPasswordReset,
} = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
// Public self-signup is DISABLED — accounts are created by admins via User
// Management (POST /api/users). Kept as a 403 stub so any old client gets a
// clear message instead of a silent 404.
router.post('/signup', (req, res) => res.status(403).json({
  success: false,
  message: 'Self sign-up is disabled. Please ask your lab admin to create your account.',
}));
router.post('/reset-password', auth, resetPassword);
router.post('/forgot-password', forgotPassword);
router.post('/forgot-password/verify-otp', verifyForgotPasswordOtp);
router.post('/forgot-password/reset', forgotPasswordReset);

module.exports = router;