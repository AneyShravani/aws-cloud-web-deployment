// ============================================================
// CONTROLLER: projectController  (project directory / continuation)
// ------------------------------------------------------------
// A "project" is an Assignment (it owns the persistent access ID).
// These org-scoped, read-only endpoints power the type-to-continue
// dropdown in the request forms — for both admins (manual) and
// students (self-service):
//   GET /search?q=  -> projects whose name starts with q
//   GET /exact?name -> the project with this exact name, or null
//                      (used to enforce name uniqueness for NEW ones)
// ============================================================

const Assignment = require('../models/Assignment');
const { getStatus } = require('../services/referenceIdService');
const { normalizeProjectName } = require('../utils/projectName');

const shapeProject = (a) => {
  const completed = a.outcome === 'COMPLETED';
  return {
    id: a._id,
    name: a.projectName,
    nameKey: a.nameKey,
    referenceId: a.referenceId,
    holderName: a.labUserId?.name || '—',
    holderRoll: a.labUserId?.rollNumber || '',
    startDate: a.startDate,
    endDate: a.endDate,
    liveStatus: getStatus(a), // ACTIVE | NEARING_EXPIRY | EXPIRED
    outcome: a.outcome || 'NONE', // NONE | COMPLETED | INCOMPLETE
    liveUrl: a.liveUrl || '',
    completed, // completed projects reopen for MAINTENANCE; others CONTINUE
  };
};

// GET /api/projects/search?q=
async function search(req, res, next) {
  try {
    const orgId = req.user.orgId;
    const q = normalizeProjectName(req.query.q || '');
    if (!q) return res.json({ success: true, data: [] });
    // q is normalized to [a-z0-9-] only, so it's safe to use as a regex prefix
    const rows = await Assignment.find({ orgId, nameKey: { $regex: `^${q}` } })
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate('labUserId', 'name rollNumber');
    return res.json({ success: true, data: rows.map(shapeProject) });
  } catch (err) {
    return next(err);
  }
}

// GET /api/projects/exact?name=
async function exact(req, res, next) {
  try {
    const orgId = req.user.orgId;
    const nameKey = normalizeProjectName(req.query.name || '');
    if (!nameKey) return res.json({ success: true, data: null });
    const a = await Assignment.findOne({ orgId, nameKey }).populate('labUserId', 'name rollNumber');
    return res.json({ success: true, data: a ? shapeProject(a) : null });
  } catch (err) {
    return next(err);
  }
}

module.exports = { search, exact, shapeProject };
