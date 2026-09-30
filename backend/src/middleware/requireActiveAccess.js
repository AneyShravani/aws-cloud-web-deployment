// ============================================================
// MIDDLEWARE: requireActiveAccess  (the REAL gate for students)
// ------------------------------------------------------------
// Frontend hiding of modules is only UX — this is the enforcement.
// Any student action that needs a valid access pass (booking) runs
// through here. It recomputes the caller's access live and refuses
// with a typed 403 the frontend can turn into the right message:
//   ACCOUNT_BLOCKED -> too many no-show strikes (or admin block)
//   ACCESS_EXPIRED  -> approval window ended -> raise a new request
//   NO_ACCESS       -> never approved yet
// On success it attaches req.account + req.access for downstream use.
// ============================================================

const AdminUser = require('../models/AdminUser');
const { getAccess } = require('../services/studentAccessService');

module.exports = async function requireActiveAccess(req, res, next) {
  try {
    const account = await AdminUser.findById(req.user.id);
    if (!account) {
      return res.status(401).json({ success: false, message: 'Account not found.' });
    }
    if (account.isActive === false) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_BLOCKED',
        message: account.blockedReason === 'STRIKES'
          ? 'Your account is blocked after too many missed slots. Contact your admin to reactivate it.'
          : 'Your account has been deactivated. Contact your admin.',
      });
    }

    const access = await getAccess(account);
    if (access.state === 'expired') {
      return res.status(403).json({
        success: false,
        code: 'ACCESS_EXPIRED',
        message: 'Your permission has expired. Raise a new request to continue.',
      });
    }
    if (access.state === 'none') {
      return res.status(403).json({
        success: false,
        code: 'NO_ACCESS',
        message: 'You have no active access yet. Raise a request to get started.',
      });
    }

    req.account = account;
    req.access = access;
    return next();
  } catch (err) {
    return next(err);
  }
};
