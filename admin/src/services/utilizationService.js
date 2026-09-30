// ============================================================
// SERVICE: utilizationService
// ------------------------------------------------------------
// getAll()          -> GET  /api/utilization
// create(record)    -> POST /api/utilization
// update(id, data)  -> PUT  /api/utilization/:id
//   (mark done, add live URL, toggle active/inactive)
// ============================================================

import api from './api';

const utilizationService = {
    getAll: async () => (await api.get('/utilization')).data,
    create: async (payload) => (await api.post('/utilization', payload)).data,
    update: async (id, payload) => (await api.put(`/utilization/${id}`, payload)).data,
};

export default utilizationService;