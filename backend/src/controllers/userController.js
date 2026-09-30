// ============================================================
// CONTROLLER: userController  (User Management — Admin only)
// ------------------------------------------------------------
// Thin HTTP layer over userService. Always org-scoped via
// req.user.orgId (never trusts the client for org).
// ============================================================
const userService = require('../services/userService');

const handle = (res, error, fallback) => {
  if ([400, 403, 404, 409].includes(error.statusCode)) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: 'Internal Server Error' });
};

const createUser = async (req, res) => {
  try {
    return res.status(201).json(await userService.createUser(req.user.orgId, req.body));
  } catch (error) {
    return handle(res, error, 'User creation failed:');
  }
};

const listUsers = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    return res.status(200).json(await userService.listUsers(req.user.orgId));
  } catch (error) {
    return handle(res, error, 'User listing failed:');
  }
};

const lookupUser = async (req, res) => {
  try {
    return res.status(200).json(await userService.lookupByEmail(req.user.orgId, req.query.email));
  } catch (error) {
    return handle(res, error, 'User lookup failed:');
  }
};

const resendCredentials = async (req, res) => {
  try {
    return res.status(200).json(await userService.resendCredentials(req.user.orgId, req.params.id));
  } catch (error) {
    return handle(res, error, 'Resend credentials failed:');
  }
};

const setActive = async (req, res) => {
  try {
    // reactivation carries a fresh strike allowance ("how many strikes this time?")
    return res.status(200).json(
      await userService.setActive(req.user.orgId, req.params.id, req.body.isActive, { strikeLimit: req.body.strikeLimit })
    );
  } catch (error) {
    return handle(res, error, 'User status update failed:');
  }
};

// Add an email to a legacy account-less user → creates their login + emails creds.
const attachEmail = async (req, res) => {
  try {
    return res.status(200).json(
      await userService.attachEmail(req.user.orgId, req.body.labUserId, req.body.email)
    );
  } catch (error) {
    return handle(res, error, 'Attach email failed:');
  }
};

module.exports = { createUser, listUsers, lookupUser, resendCredentials, setActive, attachEmail };
