const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');
const Organization = require('../models/Organization');
const { generateToken } = require('../utils/generateToken');
const { sendPasswordResetOtp } = require('./emailService');

const passwordPolicyMessage =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

const isValidPassword = (password) =>
  typeof password === 'string' &&
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password) &&
  /[!@#$%^&*]/.test(password);

const generateOtp = () => String(crypto.randomInt(100000, 1000000));

const loginAdmin = async ({ email, password }) => {
  if (!email || !password) {
    const error = new Error('Invalid Credentials');
    error.statusCode = 401;
    throw error;
  }

  const user = await AdminUser.findOne({
    email: email.trim().toLowerCase(),
  })
    .select('+password')
    .populate('orgId', 'name');

  if (!user) {
    const error = new Error('Invalid Credentials');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    const error = new Error('Invalid Credentials');
    error.statusCode = 401;
    throw error;
  }

  // Strike-blocked students may STILL sign in — they just can't use any module
  // (every screen shows "blocked, contact your admin", and booking is refused
  // server-side by requireActiveAccess). Only an ADMIN deactivation is a hard
  // login block.
  if (user.isActive === false && user.blockedReason !== 'STRIKES') {
    const error = new Error('This account has been deactivated. Contact your admin.');
    error.statusCode = 403;
    throw error;
  }

  const organization = user.orgId && typeof user.orgId === 'object' ? user.orgId : null;
  const resolvedOrgId = organization?._id || user.orgId;
  const token = generateToken({
    _id: user._id,
    role: user.role,
    orgId: resolvedOrgId,
  });

  return {
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      orgId: resolvedOrgId,
      organizationName: organization?.name || '',
      firstLogin: user.firstLogin,
      rollNumber: user.rollNumber || null,
      department: user.department || null,
      userType: user.userType || null,
    },
  };
};

const signupStudent = async ({ name, email, password, rollNumber, department, userType, orgId }) => {
  if (!name || !email || !password || !rollNumber || !department || !userType || !orgId) {
    const error = new Error('All fields are required.');
    error.statusCode = 400;
    throw error;
  }

  if (!isValidPassword(password)) {
    const error = new Error(passwordPolicyMessage);
    error.statusCode = 400;
    throw error;
  }

  // orgId must reference a real organization — never trust a client-supplied id blindly
  const organization = await Organization.findById(orgId).catch(() => null);
  if (!organization) {
    const error = new Error('Invalid organization selected.');
    error.statusCode = 400;
    throw error;
  }

  const existing = await AdminUser.findOne({ email: email.trim().toLowerCase() });
  if (existing) {
    const error = new Error('An account with this email already exists.');
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const student = await AdminUser.create({
    name,
    email: email.trim().toLowerCase(),
    password: hashedPassword,
    role: 'STUDENT',
    orgId,
    rollNumber,
    department,
    userType,
    firstLogin: false, // self-registered, no forced reset
  });

  return {
    success: true,
    message: 'Account created successfully. Please log in.',
    userId: student._id,
  };
};

const resetPassword = async (userId, { newPassword, confirmPassword } = {}) => {
  if (!newPassword || !confirmPassword) {
    const error = new Error('New password and confirm password are required.');
    error.statusCode = 400;
    throw error;
  }

  if (newPassword !== confirmPassword) {
    const error = new Error('Passwords do not match.');
    error.statusCode = 400;
    throw error;
  }

  if (!isValidPassword(newPassword)) {
    const error = new Error(passwordPolicyMessage);
    error.statusCode = 400;
    throw error;
  }

  const user = await AdminUser.findById(userId).select('+password');

  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  user.password = hashedPassword;
  user.firstLogin = false;
  await user.save();

  return {
    success: true,
    message: 'Password updated successfully.',
  };
};

const requestPasswordResetOtp = async ({ email } = {}) => {
  const resolvedEmail = (email || '').trim().toLowerCase();

  if (!resolvedEmail) {
    const error = new Error('Email is required.');
    error.statusCode = 400;
    throw error;
  }

  const user = await AdminUser.findOne({ email: resolvedEmail });

  if (!user) {
    const error = new Error('No account found with this email.');
    error.statusCode = 404;
    throw error;
  }

  if (user.role === 'SUPER_ADMIN') {
    const error = new Error('Super admin cannot change password.');
    error.statusCode = 403;
    throw error;
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.resetPasswordOtpHash = otpHash;
  user.resetPasswordOtpExpires = expiresAt;
  await user.save();

  await sendPasswordResetOtp({
    adminName: user.name,
    adminEmail: user.email,
    otp,
  });

  return {
    success: true,
    message: 'OTP sent successfully.',
  };
};

const verifyPasswordResetOtp = async ({ email, otp } = {}) => {
  const resolvedEmail = (email || '').trim().toLowerCase();
  const resolvedOtp = (otp || '').trim();

  if (!resolvedEmail || !resolvedOtp) {
    const error = new Error('Email and OTP are required.');
    error.statusCode = 400;
    throw error;
  }

  const user = await AdminUser.findOne({ email: resolvedEmail }).select(
    '+resetPasswordOtpHash +resetPasswordOtpExpires'
  );

  if (!user || !user.resetPasswordOtpHash || !user.resetPasswordOtpExpires) {
    const error = new Error('Invalid or expired OTP.');
    error.statusCode = 400;
    throw error;
  }

  // Only SUPER_ADMIN is blocked
  if (user.role === 'SUPER_ADMIN') {
    const error = new Error('Super admin cannot change password.');
    error.statusCode = 403;
    throw error;
  }

  if (user.resetPasswordOtpExpires.getTime() < Date.now()) {
    const error = new Error('Invalid or expired OTP.');
    error.statusCode = 400;
    throw error;
  }

  const isMatch = await bcrypt.compare(resolvedOtp, user.resetPasswordOtpHash);

  if (!isMatch) {
    const error = new Error('Invalid or expired OTP.');
    error.statusCode = 400;
    throw error;
  }

  user.resetPasswordOtpHash = null;
  user.resetPasswordOtpExpires = null;
  await user.save();

  const resetToken = jwt.sign(
    {
      id: user._id,
      purpose: 'password_reset',
    },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );

  return {
    success: true,
    message: 'OTP verified successfully.',
    resetToken,
  };
};
const resetForgotPassword = async ({ resetToken, newPassword, confirmPassword } = {}) => {
  if (!resetToken) {
    const error = new Error('Reset token is required.');
    error.statusCode = 400;
    throw error;
  }

  let decoded;

  try {
    decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
  } catch (error) {
    const tokenError = new Error('Reset token is invalid or expired.');
    tokenError.statusCode = 401;
    throw tokenError;
  }

  if (decoded.purpose !== 'password_reset') {
    const error = new Error('Reset token is invalid or expired.');
    error.statusCode = 401;
    throw error;
  }

  return resetPassword(decoded.id, { newPassword, confirmPassword });
};

module.exports = {
  loginAdmin,
  signupStudent,
  resetPassword,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetForgotPassword,
};