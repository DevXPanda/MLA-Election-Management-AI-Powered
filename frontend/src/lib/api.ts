import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401/403
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 Unauthorized — Token expired or invalid, must logout
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    // 403 Forbidden — Logged in but no permission for this specific resource
    // We let the component handle this (e.g. show an error toast) instead of logging out
    
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth API ───
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  getProfile: () => api.get('/auth/profile'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
};

// ─── Users API ───
export const usersAPI = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/users', { params }),
  getOne: (id: number) => api.get(`/users/${id}`),
  create: (data: Record<string, unknown>) => api.post('/users', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
  getRoles: () => api.get('/users/roles'),
};

// ─── Constituency API ───
export const constituencyAPI = {
  getHierarchy: () => api.get('/constituency/hierarchy'),
  getStates: () => api.get('/constituency/states'),
  createState: (data: Record<string, unknown>) => api.post('/constituency/states', data),
  updateState: (id: number, data: Record<string, unknown>) => api.put(`/constituency/states/${id}`, data),
  deleteState: (id: number) => api.delete(`/constituency/states/${id}`),
  getDistricts: (stateId?: number) =>
    api.get('/constituency/districts', { params: stateId ? { state_id: stateId } : {} }),
  createDistrict: (data: Record<string, unknown>) => api.post('/constituency/districts', data),
  updateDistrict: (id: number, data: Record<string, unknown>) => api.put(`/constituency/districts/${id}`, data),
  deleteDistrict: (id: number) => api.delete(`/constituency/districts/${id}`),
  getConstituencies: (districtId?: number) =>
    api.get('/constituency/constituencies', { params: districtId ? { district_id: districtId } : {} }),
  createConstituency: (data: Record<string, unknown>) => api.post('/constituency/constituencies', data),
  updateConstituency: (id: number, data: Record<string, unknown>) =>
    api.put(`/constituency/constituencies/${id}`, data),
  deleteConstituency: (id: number) => api.delete(`/constituency/constituencies/${id}`),
  getAreas: (constituencyId?: number) =>
    api.get('/constituency/areas', { params: constituencyId ? { constituency_id: constituencyId } : {} }),
  createArea: (data: Record<string, unknown>) => api.post('/constituency/areas', data),
  updateArea: (id: number, data: Record<string, unknown>) => api.put(`/constituency/areas/${id}`, data),
  deleteArea: (id: number) => api.delete(`/constituency/areas/${id}`),
  getWards: (constituencyId?: number, areaId?: number) =>
    api.get('/constituency/wards', { 
      params: { 
        ...(constituencyId ? { constituency_id: constituencyId } : {}),
        ...(areaId ? { area_id: areaId } : {})
      } 
    }),
  createWard: (data: Record<string, unknown>) => api.post('/constituency/wards', data),
  updateWard: (id: number, data: Record<string, unknown>) => api.put(`/constituency/wards/${id}`, data),
  deleteWard: (id: number) => api.delete(`/constituency/wards/${id}`),
  getBooths: (wardId?: number) =>
    api.get('/constituency/booths', { params: wardId ? { ward_id: wardId } : {} }),
  createBooth: (data: Record<string, unknown>) => api.post('/constituency/booths', data),
  updateBooth: (id: number, data: Record<string, unknown>) => api.put(`/constituency/booths/${id}`, data),
  deleteBooth: (id: number) => api.delete(`/constituency/booths/${id}`),
};

// ─── Teams API ───
export const teamsAPI = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/teams', { params }),
  getStats: () => api.get('/teams/stats'),
  add: (data: Record<string, unknown>) => api.post('/teams', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/teams/${id}`, data),
  remove: (id: number) => api.delete(`/teams/${id}`),
};

// ─── Tasks API ───
export const tasksAPI = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/tasks', { params }),
  getStats: () => api.get('/tasks/stats'),
  create: (data: Record<string, unknown>) => api.post('/tasks', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/tasks/${id}`, data),
  delete: (id: number) => api.delete(`/tasks/${id}`),
};

// ─── Surveys API ───
export const surveysAPI = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/surveys', { params }),
  getStats: () => api.get('/surveys/stats'),
  getIssues: () => api.get('/surveys/issues'),
  createIssue: (data: Record<string, unknown>) => api.post('/surveys/issues', data),
  create: (data: Record<string, unknown>) => api.post('/surveys', data),
  delete: (id: number) => api.delete(`/surveys/${id}`),
};

// ─── Events API ───
export const eventsAPI = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/events', { params }),
  create: (data: Record<string, unknown>) => api.post('/events', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/events/${id}`, data),
  delete: (id: number) => api.delete(`/events/${id}`),
  getParticipants: (id: number) => api.get(`/events/${id}/participants`),
  addParticipants: (id: number, data: Record<string, unknown>) =>
    api.post(`/events/${id}/participants`, data),
  markAttendance: (id: number, data: Record<string, unknown>) =>
    api.post(`/events/${id}/attendance`, data),
};

// ─── Voters API ───
export const votersAPI = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/voters', { params }),
  getStats: () => api.get('/voters/stats'),
  create: (data: Record<string, unknown>) => api.post('/voters', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/voters/${id}`, data),
  delete: (id: number) => api.delete(`/voters/${id}`),
};

// ─── Dashboard API ───
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getActivity: (params?: Record<string, string | number>) =>
    api.get('/dashboard/activity', { params }),
};

// ─── Messages API ───
export const messagesAPI = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/messages', { params }),
  send: (data: Record<string, unknown>) => api.post('/messages', data),
  getInbox: () => api.get('/messages/inbox'),
  markAsRead: (id: number) => api.put(`/messages/${id}/read`),
  delete: (id: number) => api.delete(`/messages/${id}`),
};

export const mediaAPI = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/media', { params }),
  create: (data: Record<string, unknown>) => api.post('/media', data),
  trackDownload: (id: number) => api.post(`/media/${id}/download`),
  delete: (id: number) => api.delete(`/media/${id}`),
};

// ─── Analytics API ───
export const analyticsAPI = {
  getBoothStrength: () => api.get('/analytics/booth-strength'),
  getWardSurveyCount: () => api.get('/analytics/ward-survey-count'),
  getTopIssues: () => api.get('/analytics/top-issues'),
  getWorkerPerformance: () => api.get('/analytics/worker-performance'),
  getDailyTrends: () => api.get('/analytics/daily-trends'),
  getOverview: () => api.get('/analytics/overview'),
};

export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id: number) => api.put(`/notifications/mark-read/${id}`),
  markAllRead: () => api.put('/notifications/mark-read-all'),
};

// ─── Work Allocation API ───
export const workAllocationAPI = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/work-allocation', { params }),
  getMyTasks: () => api.get('/work-allocation/my-tasks'),
  getTypes: () => api.get('/work-allocation/types'),
  getStats: () => api.get('/work-allocation/stats'),
  create: (data: Record<string, unknown>) => api.post('/work-allocation', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/work-allocation/${id}`, data),
  updateStatus: (id: number, data: Record<string, unknown>) => api.patch(`/work-allocation/${id}/status`, data),
  uploadProof: (id: number, data: Record<string, unknown>) => api.post(`/work-allocation/${id}/upload-proof`, data),
  delete: (id: number) => api.delete(`/work-allocation/${id}`),
};

// ─── AI Chat API ───
export const aiAPI = {
  chat: (message: string, history: Array<{ role: string; content: string }>, session_id?: number) =>
    api.post('/ai/chat', { message, history, session_id }),
  getSessions: () =>
    api.get('/ai/sessions'),
  getSessionMessages: (sessionId: number) =>
    api.get(`/ai/sessions/${sessionId}/messages`),
  updateSession: (sessionId: number, title: string) =>
    api.put(`/ai/sessions/${sessionId}`, { title }),
  deleteSession: (sessionId: number) =>
    api.delete(`/ai/sessions/${sessionId}`),
};
