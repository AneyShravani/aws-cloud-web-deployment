// ============================================================
// SERVICE: logService  (Logs module)
// ------------------------------------------------------------
// getByReferenceId(refId) -> GET  /api/logs/reference/:refId
// createLog(data)          -> POST /api/logs
// getAll()                 -> GET  /api/logs
// ============================================================
import api from './api';

const logService = {
    getByReferenceId: async (referenceId) => {
        const response = await api.get(`/logs/reference/${referenceId}`);
        return response.data;
    },
    createLog: async (referenceId, loginTime, logoutTime) => {
        const response = await api.post('/logs', {
            referenceId,
            loginTime,
            logoutTime,
        });
        return response.data;
    },
    getAll: async () => {
        const response = await api.get('/logs');
        return response.data;
    },
};

export default logService;