// ============================================================
// SERVICE: assignmentService  (core workflow, Section 4)
// ------------------------------------------------------------
// getRequests()           -> GET  /api/assignments/requests
// createRequest(formData)  -> POST /api/assignments/requests
// submitRequest(formData)  -> POST /api/assignments/request
//   (multipart: user details + HOD letter file)
// getMyRequests()         -> GET  /api/assignments/my-requests
// assign(...)              -> POST /api/assignments/assign
//   (returns the generated Reference ID)
// getAll()                 -> GET  /api/assignments
// ============================================================
import api from './api';

const assignmentService = {
    getRequests: async () => {
        const response = await api.get('/assignments/requests');
        return response.data;
    },
    createRequest: async (formData) => {
        const response = await api.post('/assignments/requests', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },
    submitRequest: async (formData) => {
        const response = await api.post('/assignments/request', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },
    getMyRequests: async () => {
        const response = await api.get('/assignments/my-requests');
        return response.data;
    },
    assign: async (labUserId, systemId, projectName, startDate, endDate) => {
        const response = await api.post('/assignments/assign', {
            labUserId,
            systemId,
            projectName,
            startDate,
            endDate,
        });
        return response.data;
    },
    // v2 slot-booking: approve a request WITHOUT pinning a machine.
    // Creates the umbrella + the user's persistent Reference ID.
    approve: async (labUserId, overrides = {}) => {
        const response = await api.post('/assignments/approve', { labUserId, ...overrides });
        return response.data;
    },
    getAll: async () => {
        const response = await api.get('/assignments');
        return response.data;
    },
    // Approved-users management (edit / remove an approval umbrella)
    update: async (id, payload) => {
        const response = await api.put(`/assignments/${id}`, payload);
        return response.data;
    },
    // Utilization close-out: mark a project's outcome (COMPLETED/INCOMPLETE/NONE)
    setOutcome: async (id, payload) => {
        const response = await api.patch(`/assignments/${id}/outcome`, payload);
        return response.data;
    },
    remove: async (id) => {
        const response = await api.delete(`/assignments/${id}`);
        return response.data;
    },
};

export default assignmentService;