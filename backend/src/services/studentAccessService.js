// ============================================================
// SERVICE: studentAccessService  (the student's access lifecycle)
// ------------------------------------------------------------
// A student's right to use the lab lives on their Assignment (the
// approval umbrella): referenceId + [startDate, endDate] + status.
// A student may have several over time (one per request); "current
// access" is the assignment covering today, else the most recent.
//
// Access STATE is computed LIVE from endDate (via referenceIdService
// .getStatus) so it's correct even if the daily cron never ran:
//   none    -> never approved
//   active  -> comfortably inside the window
//   nearing -> within the near-expiry threshold
//   expired -> endDate has passed
//
// This is the single source of truth the whole student app + the
// requireActiveAccess middleware read to gate modules. It is
// INDEPENDENT of the strike/block gate (that lives on the account).
// ============================================================

const LabUser = require('../models/LabUser');
const Assignment = require('../models/Assignment');
const { getStatus } = require('./referenceIdService');

const MS_PER_DAY = 86400000;
const STATE_MAP = { ACTIVE: 'active', NEARING_EXPIRY: 'nearing', EXPIRED: 'expired' };

function daysUntil(endDate) {
  return Math.ceil((new Date(endDate) - new Date()) / MS_PER_DAY);
}

// Every LabUser id that belongs to this login account in the org.
async function labUserIdsFor(accountId, orgId) {
  const labUsers = await LabUser.find({ studentId: accountId, orgId }).select('_id');
  return labUsers.map((u) => u._id);
}

// The student's "current" assignment: the one covering today if any,
// otherwise the most recent by endDate. null if never approved.
async function currentAssignment(accountId, orgId) {
  const ids = await labUserIdsFor(accountId, orgId);
  if (!ids.length) return null;

  const now = new Date();
  const covering = await Assignment.findOne({
    orgId,
    labUserId: { $in: ids },
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).sort({ createdAt: -1 });
  if (covering) return covering;

  return Assignment.findOne({ orgId, labUserId: { $in: ids } }).sort({ endDate: -1 });
}

// The one access object the student app + middleware read.
async function getAccess(account) {
  const a = await currentAssignment(account._id, account.orgId);
  if (!a) {
    return { state: 'none', referenceId: null, projectName: null, startDate: null, endDate: null, daysLeft: null };
  }
  const status = getStatus(a); // ACTIVE / NEARING_EXPIRY / EXPIRED
  return {
    state: STATE_MAP[status] || 'active',
    referenceId: a.referenceId,
    projectName: a.projectName,
    startDate: a.startDate,
    endDate: a.endDate,
    daysLeft: daysUntil(a.endDate),
    assignmentId: a._id,
    labUserId: a.labUserId,
  };
}

// All of the student's currently-usable projects (active or nearing — not
// expired). Used to offer a "which project?" picker at booking time when a
// student holds more than one live access ID at once.
async function activeProjects(account) {
  const ids = await labUserIdsFor(account._id, account.orgId);
  if (!ids.length) return [];
  const rows = await Assignment.find({ orgId: account.orgId, labUserId: { $in: ids } }).sort({ endDate: -1 });
  return rows
    .map((a) => ({ a, status: getStatus(a) }))
    .filter((x) => x.status !== 'EXPIRED')
    .map(({ a, status }) => ({
      id: a._id,
      referenceId: a.referenceId,
      projectName: a.projectName,
      startDate: a.startDate,
      endDate: a.endDate,
      state: status === 'NEARING_EXPIRY' ? 'nearing' : 'active',
    }));
}

// Resolve the assignment covering a SPECIFIC booking date for this student
// (used when creating a booking). Returns the Assignment or null.
async function assignmentForDate(accountId, orgId, date) {
  const ids = await labUserIdsFor(accountId, orgId);
  if (!ids.length) return null;
  return Assignment.findOne({
    orgId,
    labUserId: { $in: ids },
    startDate: { $lte: date },
    endDate: { $gte: date },
  }).sort({ createdAt: -1 });
}

module.exports = { getAccess, currentAssignment, assignmentForDate, activeProjects, labUserIdsFor };
