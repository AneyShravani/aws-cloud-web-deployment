// ============================================================
// SERVICE: systemService
// ------------------------------------------------------------
// getByLab(labId)          -> GET  /api/systems/lab/:labId
// getAvailableByLab(labId) -> GET  /api/systems/available/:labId
// getOccupancy(labId)      -> GET  /api/systems/occupancy/:labId
// addSystems(labId, count) -> POST /api/systems
// updateSystem(id, data)   -> PUT  /api/systems/:systemId       (NEW)
// deleteSystem(id)         -> DELETE /api/systems/:systemId     (NEW)
// ============================================================
import api from './api';

const systemService = {
    getByLab: async (labId) => (await api.get(`/systems/lab/${labId}`)).data,
    getAvailableByLab: async (labId) => (await api.get(`/systems/available/${labId}`)).data,
    getOccupancy: async (labId) => (await api.get(`/systems/occupancy/${labId}`)).data,
    addSystems: async (labId, count) => (await api.post('/systems', { labId, count })).data,
    updateSystem: async (systemId, data) => (await api.put(`/systems/${systemId}`, data)).data,
    deleteSystem: async (systemId) => (await api.delete(`/systems/${systemId}`)).data,
};

export default systemService;