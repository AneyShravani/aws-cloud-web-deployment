import api from './api';

const authService = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  signup: async (payload) => {
    const response = await api.post('/auth/signup', payload);
    return response.data;
  },
  getPublicOrganizations: async () => {
    const response = await api.get('/organizations/public');
    return response.data;
  },
  logout: async () => Promise.resolve(),
  resetPassword: async (payload) => {
    const response = await api.post('/auth/reset-password', payload);
    return response.data;
  },
  forgotPassword: async (payload) => {
    const response = await api.post('/auth/forgot-password', payload);
    return response.data;
  },
  verifyForgotPasswordOtp: async (payload) => {
    const response = await api.post('/auth/forgot-password/verify-otp', payload);
    return response.data;
  },
  resetForgotPassword: async (payload) => {
    const response = await api.post('/auth/forgot-password/reset', payload);
    return response.data;
  },
};

export default authService;