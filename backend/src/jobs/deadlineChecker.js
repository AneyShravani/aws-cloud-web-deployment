// ============================================================
// JOB: deadlineChecker  (periodic — flips assignment status)
// ------------------------------------------------------------
// Keeps the STORED Assignment.status in step with the live,
// endDate-derived status (referenceIdService.getStatus):
//   ACTIVE -> NEARING_EXPIRY  (within the near-expiry threshold)
//   *      -> EXPIRED         (endDate has passed)
// On each *transition* it drops a notification (student + admin
// panel) exactly once. Started from server.js.
//
// NOTE: student access is ALSO computed live at request time
// (studentAccessService), so gating stays correct even if this
// job never runs — this job is about stored status + alerts.
// ============================================================

const Assignment = require('../models/Assignment');
const { getStatus } = require('../services/referenceIdService');
const { createNotification, createDeadlineAlert } = require('../services/notificationService');

async function runDeadlineCheck() {
  // anything not already terminally EXPIRED is worth re-checking
  const assignments = await Assignment.find({ status: { $ne: 'EXPIRED' } });

  let changed = 0;
  for (const a of assignments) {
    const live = getStatus(a); // ACTIVE | NEARING_EXPIRY | EXPIRED
    if (live === a.status) continue;

    const previous = a.status;
    a.status = live;
    await a.save();
    changed += 1;

    try {
      if (live === 'NEARING_EXPIRY' && previous === 'ACTIVE') {
        await createDeadlineAlert(a);
        await createNotification(
          a.labUserId, a.orgId, a._id,
          'Access Expiring Soon',
          `Your access (${a.referenceId}) for "${a.projectName}" is expiring soon. Raise a new request to renew it.`
        );
      } else if (live === 'EXPIRED') {
        await createNotification(
          a.labUserId, a.orgId, a._id,
          'Access Expired',
          `Your access (${a.referenceId}) for "${a.projectName}" has expired. Raise a new request to continue using the lab.`
        );
      }
    } catch (err) {
      console.error('deadlineChecker notification failed:', err.message);
    }
  }
  return changed;
}

module.exports = { runDeadlineCheck };
