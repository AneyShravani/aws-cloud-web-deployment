// ============================================================
// SERVICE: userService  (User Management — admin onboards people)
// ------------------------------------------------------------
// An "account" is an AdminUser with role STUDENT (the end-user
// role) + a userType (student / faculty / hod / hr / employee).
// The admin creates it with the person's COLLEGE EMAIL; a temp
// password is generated, emailed, and firstLogin=true forces a
// reset on first login. No access ID here — that's issued only
// when a request is approved.
// ============================================================
const bcrypt = require('bcrypt');
const AdminUser = require('../models/AdminUser');
const LabUser = require('../models/LabUser');
const Organization = require('../models/Organization');
const { generatePassword } = require('../utils/generatePassword');
const { sendUserCredentials } = require('./emailService');
const { strikeStatus } = require('./strikeService');

const USER_TYPES = ['student', 'faculty', 'hod', 'hr', 'employee'];
const DEFAULT_STRIKE_LIMIT = 3;

// parse an admin-supplied strike allowance into a clean positive integer
const cleanStrikeLimit = (value) => {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_STRIKE_LIMIT;
  return Math.min(n, 50); // sane ceiling
};

const httpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const shape = (u) => ({
  id: u._id.toString(),
  hasAccount: true,       // a real login account (has email)
  labUserId: null,
  name: u.name,
  email: u.email,
  rollNumber: u.rollNumber || '',
  department: u.department || '',
  userType: u.userType || 'student',
  isActive: u.isActive !== false,
  firstLogin: u.firstLogin,
  createdAt: u.createdAt,
  // strike gate
  strikeLimit: u.strikeLimit || DEFAULT_STRIKE_LIMIT,
  strikeCount: u.strikeCount || 0,
  blockedReason: u.blockedReason || 'NONE',
  strike: strikeStatus(u),
});

// A legacy user who was approved BEFORE User Management existed: we have their
// details on a LabUser but no login account (no email). They still belong in
// User Management — the admin can add an email to create their account + send
// credentials. Strikes don't apply until they have an account.
const shapeLabUser = (lu) => ({
  id: lu._id.toString(),
  hasAccount: false,
  labUserId: lu._id.toString(),
  name: lu.name,
  email: '',
  rollNumber: lu.rollNumber && lu.rollNumber !== 'NA' ? lu.rollNumber : '',
  department: lu.department || '',
  userType: lu.userType || 'student',
  isActive: true,
  firstLogin: null,
  createdAt: lu.createdAt,
  strikeLimit: null,
  strikeCount: null,
  blockedReason: 'NONE',
  strike: null,
});

// identity key for de-duping a person across accounts + legacy LabUsers
const personKey = (rollNumber, name) =>
  `${(rollNumber && rollNumber !== 'NA' ? rollNumber : '').toLowerCase().trim()}::${(name || '').toLowerCase().trim()}`;

const requireOrg = (orgId) => {
  if (!orgId) throw httpError(403, 'Organization context is required.');
};

// validate + normalise the create/edit payload
const cleanPayload = (payload = {}) => {
  const name = (payload.name || '').trim();
  const email = normalizeEmail(payload.email);
  const rollNumber = (payload.rollNumber || '').trim();
  const department = (payload.department || '').trim();
  const userType = USER_TYPES.includes(payload.userType) ? payload.userType : 'student';
  const strikeLimit = cleanStrikeLimit(payload.strikeLimit);

  if (!name) throw httpError(400, 'Name is required.');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'A valid email is required.');
  return { name, email, rollNumber, department, userType, strikeLimit };
};

// Create an account, generate + email a temp password. Best-effort email:
// account is still created if mail fails, and we report emailSent back.
const createUser = async (orgId, payload) => {
  requireOrg(orgId);
  const { name, email, rollNumber, department, userType, strikeLimit } = cleanPayload(payload);

  const existing = await AdminUser.findOne({ email });
  if (existing) throw httpError(409, 'An account with this email already exists.');

  const org = await Organization.findById(orgId).select('name');
  const tempPassword = generatePassword(12);
  const hashed = await bcrypt.hash(tempPassword, 10);

  const user = await AdminUser.create({
    name, email, password: hashed, role: 'STUDENT', orgId,
    rollNumber, department, userType,
    firstLogin: true, isActive: true,
    strikeLimit, strikeCount: 0, blockedReason: 'NONE',
  });

  let emailSent = true;
  try {
    await sendUserCredentials({ userName: name, userEmail: email, temporaryPassword: tempPassword, organizationName: org?.name || '' });
  } catch (err) {
    emailSent = false;
    console.error('Failed to email user credentials:', err.message);
  }

  return { success: true, user: shape(user), emailSent };
};

// Unified list: real accounts + legacy account-less LabUsers (approved before
// User Management existed). De-duped so a person referenced by both an account
// and an old LabUser only appears once (as the account).
const listUsers = async (orgId) => {
  requireOrg(orgId);

  const accounts = await AdminUser.find({ orgId, role: 'STUDENT' }).sort({ createdAt: -1 });
  const accountRows = accounts.map(shape);
  const seen = new Set(accountRows.map((a) => personKey(a.rollNumber, a.name)));

  // account-less legacy users (no login yet)
  const orphans = await LabUser.find({ orgId, studentId: null }).sort({ createdAt: -1 });
  const orphanRows = [];
  for (const lu of orphans) {
    const key = personKey(lu.rollNumber, lu.name);
    if (key && seen.has(key)) continue; // already represented (by an account or an earlier orphan)
    seen.add(key);
    orphanRows.push(shapeLabUser(lu));
  }

  return { success: true, users: [...accountRows, ...orphanRows] };
};

// used by Manual Request autofill — returns the account or null (never throws on "not found")
const lookupByEmail = async (orgId, email) => {
  requireOrg(orgId);
  const resolved = normalizeEmail(email);
  if (!resolved) return { success: true, user: null };
  const user = await AdminUser.findOne({ orgId, email, role: 'STUDENT' });
  return { success: true, user: user ? shape(user) : null };
};

// regenerate + re-email a temp password, force reset again
const resendCredentials = async (orgId, id) => {
  requireOrg(orgId);
  const user = await AdminUser.findOne({ _id: id, orgId, role: 'STUDENT' });
  if (!user) throw httpError(404, 'User not found.');

  const org = await Organization.findById(orgId).select('name');
  const tempPassword = generatePassword(12);
  user.password = await bcrypt.hash(tempPassword, 10);
  user.firstLogin = true;
  await user.save();

  let emailSent = true;
  try {
    await sendUserCredentials({ userName: user.name, userEmail: user.email, temporaryPassword: tempPassword, organizationName: org?.name || '' });
  } catch (err) {
    emailSent = false;
    console.error('Failed to resend user credentials:', err.message);
  }
  return { success: true, message: 'New credentials sent.', emailSent };
};

// Toggle an account's active state.
//  - Deactivating: block login, tag reason 'ADMIN'.
//  - Reactivating: clear the block AND reset the strike counter, setting a
//    FRESH strike allowance the admin chooses at this moment (the "how many
//    strikes this time?" prompt). Falls back to the current limit if omitted.
const setActive = async (orgId, id, isActive, opts = {}) => {
  requireOrg(orgId);
  const user = await AdminUser.findOne({ _id: id, orgId, role: 'STUDENT' });
  if (!user) throw httpError(404, 'User not found.');

  if (isActive) {
    user.isActive = true;
    user.blockedReason = 'NONE';
    user.strikeCount = 0; // fresh start on reactivation
    if (opts.strikeLimit !== undefined && opts.strikeLimit !== null && opts.strikeLimit !== '') {
      user.strikeLimit = cleanStrikeLimit(opts.strikeLimit);
    }
  } else {
    user.isActive = false;
    user.blockedReason = 'ADMIN';
  }
  await user.save();
  return { success: true, user: shape(user) };
};

// Find an account by email within the org, or create one (with emailed creds).
// Used by Manual Request when the admin approves a walk-in whose email isn't
// registered yet. Returns { account, created }.
const findOrCreateAccount = async (orgId, payload) => {
  requireOrg(orgId);
  const { name, email, rollNumber, department, userType, strikeLimit } = cleanPayload(payload);

  const existing = await AdminUser.findOne({ email });
  if (existing) return { account: existing, created: false };

  const org = await Organization.findById(orgId).select('name');
  const tempPassword = generatePassword(12);
  const hashed = await bcrypt.hash(tempPassword, 10);
  const account = await AdminUser.create({
    name, email, password: hashed, role: 'STUDENT', orgId,
    rollNumber, department, userType, firstLogin: true, isActive: true,
    strikeLimit, strikeCount: 0, blockedReason: 'NONE',
  });
  try {
    await sendUserCredentials({ userName: name, userEmail: email, temporaryPassword: tempPassword, organizationName: org?.name || '' });
  } catch (err) {
    console.error('Failed to email new-user credentials:', err.message);
  }
  return { account, created: true };
};

// Give a legacy (account-less) user an email → create their login account,
// email the credentials, and link ALL of that person's account-less LabUser
// records to it (so their past requests/bookings become theirs to log into).
const attachEmail = async (orgId, labUserId, email) => {
  requireOrg(orgId);
  const labUser = await LabUser.findOne({ _id: labUserId, orgId });
  if (!labUser) throw httpError(404, 'User not found.');
  if (labUser.studentId) throw httpError(409, 'This user already has a login account.');

  // find-or-create the account (emails credentials when newly created)
  const { account, created } = await findOrCreateAccount(orgId, {
    name: labUser.name,
    email,
    rollNumber: labUser.rollNumber,
    department: labUser.department,
    userType: labUser.userType,
  });

  const key = personKey(labUser.rollNumber, labUser.name);
  const orphans = await LabUser.find({ orgId, studentId: null });
  for (const lu of orphans) {
    if (personKey(lu.rollNumber, lu.name) === key) {
      lu.studentId = account._id;
      await lu.save();
    }
  }

  return { success: true, user: shape(account), created, emailSent: created };
};

module.exports = {
  createUser,
  listUsers,
  lookupByEmail,
  resendCredentials,
  setActive,
  findOrCreateAccount,
  attachEmail,
};
