// ============================================================
// SERVICE: referenceIdService  (heart of the system)
// ------------------------------------------------------------
// IDs share one shape now: <ORG_PREFIX>-<4-digit>, e.g. "TM-1042".
//   • generateOrgCode(name)     -> a new organization's ID.
//   • generateReferenceId(orgId)-> a user's access ID (access pass),
//        reusing the org's prefix with a DIFFERENT unique 4-digit.
// Every 4-digit within a prefix is unique across org codes AND all
// access IDs, so no two ever collide.
//
// getStatus(assignment) -> ACTIVE / NEARING_EXPIRY / EXPIRED from endDate.
// Used by dashboardController, jobs/deadlineChecker, assignmentController.
// ============================================================

const Organization = require('../models/Organization');
const Assignment = require('../models/Assignment');

const NEARING_EXPIRY_DAYS = 3; // kept inline per Akhilesh — flagged for possible centralization later

// Initials-style prefix from an org name: "Torii Minds" -> "TM",
// "NCET" -> "NC", falls back to "OR" if the name has no letters.
function derivePrefix(name = '') {
  const words = String(name).trim().replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  let prefix;
  if (words.length >= 2) prefix = words[0][0] + words[1][0];
  else if (words.length === 1) prefix = words[0].slice(0, 2);
  else prefix = 'OR';
  return prefix.toUpperCase();
}

// Every 4-digit already taken under this prefix — across org codes AND
// access IDs — so the next pick is guaranteed unique within the namespace.
async function usedNumbersForPrefix(prefix) {
  const startsWith = { $regex: `^${prefix}-`, $options: 'i' };
  const matcher = new RegExp(`^${prefix}-(\\d{4})$`, 'i');

  const [orgs, assignments] = await Promise.all([
    Organization.find({ orgCode: startsWith }).select('orgCode').lean(),
    Assignment.find({ referenceId: startsWith }).select('referenceId').lean(),
  ]);

  const used = new Set();
  const add = (value) => {
    const match = String(value || '').match(matcher);
    if (match) used.add(match[1]);
  };
  orgs.forEach((o) => add(o.orgCode));
  assignments.forEach((a) => add(a.referenceId));
  return used;
}

// A random 4-digit (1000–9999, always 4 chars) not already in `used`.
function pickNumber(used) {
  for (let i = 0; i < 200; i += 1) {
    const n = String(1000 + Math.floor(Math.random() * 9000));
    if (!used.has(n)) return n;
  }
  // extremely unlikely fallback: linear scan
  for (let n = 1000; n <= 9999; n += 1) {
    const s = String(n);
    if (!used.has(s)) return s;
  }
  throw new Error('No available 4-digit code left for this prefix.');
}

// A new organization ID: <prefix>-<unique 4-digit>.
async function generateOrgCode(name) {
  const prefix = derivePrefix(name);
  const used = await usedNumbersForPrefix(prefix);
  return `${prefix}-${pickNumber(used)}`;
}

// A user's access ID: same prefix as the org, a different unique 4-digit.
async function generateReferenceId(orgId) {
  const org = await Organization.findById(orgId).select('orgCode name').lean();
  const prefix = org?.orgCode ? org.orgCode.split('-')[0] : derivePrefix(org?.name || '');
  const used = await usedNumbersForPrefix(prefix);
  return `${prefix}-${pickNumber(used)}`;
}

// Computes live status of an assignment based on its endDate
function getStatus(assignment) {
  const today = new Date();
  const endDate = new Date(assignment.endDate);

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeft = Math.ceil((endDate - today) / msPerDay);

  if (daysLeft < 0) return 'EXPIRED';
  if (daysLeft <= NEARING_EXPIRY_DAYS) return 'NEARING_EXPIRY';
  return 'ACTIVE';
}

module.exports = {
  generateReferenceId,
  generateOrgCode,
  derivePrefix,
  usedNumbersForPrefix,
  pickNumber,
  getStatus,
};
