// ============================================================
// SERVICE: labService
// ------------------------------------------------------------
// getAll()        -> GET  /api/labs
// create(name)    -> POST /api/labs
// ============================================================
import api from './api';

const labService = {
  getAll: async () => (await api.get('/labs')).data,
  getById: async (labId) => (await api.get(`/labs/${labId}`)).data,
  getDetails: async (labId) => (await api.get(`/labs/${labId}/details`)).data,
  create: async (payload) => (await api.post('/labs', payload)).data,
  update: async (labId, payload) => (await api.put(`/labs/${labId}`, payload)).data,
  delete: async (labId) => (await api.delete(`/labs/${labId}`)).data,
};

export default labService;