// ============================================================
// SERVICE: dashboardService
// ------------------------------------------------------------
// getStats()               -> GET /api/dashboard/stats
//   (students, systems, tools, expenses, active assignments)
// getOccupancy()           -> GET /api/dashboard/occupancy
//   (per-lab occupied vs available + fully-occupied flag)
// checkReferenceId(refId)  -> GET /api/dashboard/reference/:refId
//   (ACTIVE / NEARING_EXPIRY / EXPIRED)
// getNotifications()       -> GET /api/dashboard/notifications
// ============================================================

import api from './api';

const getStats = () => api.get('/dashboard/stats');
const getOccupancy = () => api.get('/dashboard/occupancy');
const checkReferenceId = (refId) => api.get(`/dashboard/reference/${refId}`);

export default {
  getStats,
  getOccupancy,
  checkReferenceId,
};