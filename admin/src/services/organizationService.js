import api from './api';

const organizationService = {
  getOrganizations: async () => (await api.get('/organizations')).data,
  getOrganization: async (organizationId) => (await api.get(`/organizations/${organizationId}`)).data,
  createOrganization: async (payload) => (await api.post('/organizations', payload)).data,
  updateOrganization: async (organizationId, payload) => (await api.put(`/organizations/${organizationId}`, payload)).data,
  deleteOrganization: async (organizationId) => (await api.delete(`/organizations/${organizationId}`)).data,
};

export default organizationService;