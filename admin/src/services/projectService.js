// ============================================================
// SERVICE: projectService  (project directory / continuation)
// ------------------------------------------------------------
// Powers the type-to-continue dropdown in the request forms.
// search(q) -> GET /api/projects/search?q=  (prefix matches)
// exact(name) -> GET /api/projects/exact?name=  (uniqueness check)
// Available to both admins (manual) and students (self-service).
// ============================================================
import api from './api';

const projectService = {
  search: async (q) => (await api.get('/projects/search', { params: { q } })).data,
  exact: async (name) => (await api.get('/projects/exact', { params: { name } })).data,
};

export default projectService;
