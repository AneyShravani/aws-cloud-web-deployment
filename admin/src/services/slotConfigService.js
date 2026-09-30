// ============================================================
// SERVICE: slotConfigService  (Slot-Booking Module — v2)
// ------------------------------------------------------------
// get(labId)            -> GET /slot-config/:labId
// update(labId, payload)-> PUT /slot-config/:labId
// Pass 'default' as labId to target the organization default.
// ============================================================
import api from './api';

const slotConfigService = {
    get: async (labId = 'default') => (await api.get(`/slot-config/${labId}`)).data,
    update: async (labId, payload) => (await api.put(`/slot-config/${labId}`, payload)).data,
};

export default slotConfigService;
