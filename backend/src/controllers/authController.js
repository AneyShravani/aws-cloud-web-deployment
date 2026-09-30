const {
  loginAdmin,
  resetPassword: resetPasswordService,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetForgotPassword,
  signupStudent,
} = require('../services/authService');

const login = async (req, res) => {
  try {
    const result = await loginAdmin(req.body);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 401) {
      return res.status(401).json({ success: false, message: 'Invalid Credentials' });
    }
    // 403 = authenticated but not allowed in (deactivated / strike-blocked) —
    // pass the specific reason through so the login screen can show it.
    if (error.statusCode === 403) {
      return res.status(403).json({ success: false, message: error.message });
    }

    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const signup = async (req, res) => {
  try {
    const result = await signupStudent(req.body);
    return res.status(201).json(result);
  } catch (error) {
    if ([400, 409].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const result = await resetPasswordService(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    if ([400, 403, 404].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const result = await requestPasswordResetOtp(req.body);
    return res.status(200).json(result);
  } catch (error) {
    if ([400, 403, 404].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    console.error(error);
    return res.status(500).json({ success: false, message: 'Unable to send OTP.' });
  }
};

const verifyForgotPasswordOtp = async (req, res) => {
  try {
    const result = await verifyPasswordResetOtp(req.body);
    return res.status(200).json(result);
  } catch (error) {
    if ([400, 403].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    console.error(error);
    return res.status(500).json({ success: false, message: 'Unable to verify OTP.' });
  }
};

const forgotPasswordReset = async (req, res) => {
  try {
    const result = await resetForgotPassword(req.body);
    return res.status(200).json(result);
  } catch (error) {
    if ([400, 401, 404].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    console.error(error);
    return res.status(500).json({ success: false, message: 'Unable to update password.' });
  }
};

module.exports = {
  login,
  signup,
  resetPassword,
  forgotPassword,
  verifyForgotPasswordOtp,
  forgotPasswordReset,
};