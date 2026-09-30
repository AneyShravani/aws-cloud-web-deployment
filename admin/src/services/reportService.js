import api from './api';

const generate = async (payload) => (await api.post('/reports/generate', payload)).data;
const getAll = async () => (await api.get('/reports')).data;
const getById = async (id) => (await api.get(`/reports/${id}`)).data;
const remove = async (id) => (await api.delete(`/reports/${id}`)).data;

const downloadPdf = async (id, fallbackName = 'report.pdf') => {
  const response = await api.get(`/reports/${id}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default {
  generate,
  getAll,
  getById,
  remove,
  downloadPdf,
};
