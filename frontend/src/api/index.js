import api from './client';

export const authApi = {
  // `retry` because this is the request that meets a sleeping server first, and
  // repeating it is harmless — signing in twice leaves you signed in once.
  login: (data) => api.post('/auth/login', data, { retry: true }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
};

export const usersApi = {
  profile: () => api.get('/api/users/profile').then((r) => r.data),
  updateProfile: (data) => api.put('/api/users/profile', data).then((r) => r.data),
  changePassword: (data) => api.put('/api/users/password', data).then((r) => r.data),
  myGroup: () => api.get('/api/users/my-group').then((r) => r.data),
};

export const assignmentsApi = {
  list: () => api.get('/assignments/').then((r) => r.data),
  get: (id) => api.get(`/assignments/${id}`).then((r) => r.data),
  create: (data) => api.post('/assignments/', data).then((r) => r.data),
  update: (id, data) => api.put(`/assignments/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/assignments/${id}`).then((r) => r.data),
  mySubmissions: () => api.get('/assignments/my_submissions').then((r) => r.data),
  submissions: (id) => api.get(`/assignments/${id}/submissions`).then((r) => r.data),
  roster: (id) => api.get(`/assignments/${id}/roster`).then((r) => r.data),
  extendDeadline: (id, data) => api.post(`/assignments/${id}/extend`, data).then((r) => r.data),
  submissionDetail: (id) => api.get(`/assignments/submissions/${id}`).then((r) => r.data),
  criteria: (id) => api.get(`/assignments/${id}/criteria`).then((r) => r.data),
  saveCriteria: (id, criteria) => api.put(`/assignments/${id}/criteria`, { criteria }).then((r) => r.data),
  review: (id, data) => api.post(`/assignments/submissions/${id}/review`, data).then((r) => r.data),
  recheckPlagiarism: (id) =>
    api.post(`/assignments/submissions/${id}/plagiarism-check`).then((r) => r.data),
  submit: (id, formData) =>
    api.post(`/assignments/${id}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  exportPdf: (id) => api.get(`/assignments/export/${id}`, { responseType: 'blob' }).then((r) => r.data),
  downloadFile: (id) => api.get(`/assignments/download/${id}`, { responseType: 'blob' }).then((r) => r.data),
};

export const subjectsApi = {
  list: () => api.get('/api/subjects/').then((r) => r.data),
  assignments: (id) => api.get(`/api/subjects/${id}/assignments`).then((r) => r.data),
  ratings: () => api.get('/api/subjects/academic-ratings').then((r) => r.data),
  recalc: (id) => api.post(`/api/subjects/${id}/calculate-rating`).then((r) => r.data),
  reportPdf: () => api.get('/api/subjects/academic-report/download', { responseType: 'blob' }).then((r) => r.data),
};

export const notificationsApi = {
  list: () => api.get('/api/notifications/').then((r) => r.data),
  read: (id) => api.post(`/api/notifications/${id}/read`).then((r) => r.data),
  readAll: () => api.post('/api/notifications/read-all').then((r) => r.data),
};

export const literatureApi = {
  list: () => api.get('/api/literature/').then((r) => r.data),
  add: (formData) =>
    api.post('/api/literature/', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  update: (id, formData) =>
    api.put(`/api/literature/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  remove: (id) => api.delete(`/api/literature/${id}`).then((r) => r.data),
  download: (id) => api.get(`/api/literature/download/${id}`, { responseType: 'blob' }).then((r) => r.data),
  downloads: () => api.get('/api/literature/downloads').then((r) => r.data),
};

export const teacherApi = {
  groups: () => api.get('/api/teacher/groups').then((r) => r.data),
  groupActivity: () => api.get('/api/teacher/group-activity').then((r) => r.data),
  groupStudents: (id) => api.get(`/api/teacher/groups/${id}/students`).then((r) => r.data),
  students: () => api.get('/api/teacher/students').then((r) => r.data),
  student: (id) => api.get(`/api/teacher/student/${id}`).then((r) => r.data),
  activity: () => api.get('/api/teacher/activity').then((r) => r.data),
  // Reusable criteria library
  criteria: () => api.get('/api/teacher/criteria').then((r) => r.data),
  createCriterion: (data) => api.post('/api/teacher/criteria', data).then((r) => r.data),
  updateCriterion: (id, data) => api.put(`/api/teacher/criteria/${id}`, data).then((r) => r.data),
  deleteCriterion: (id) => api.delete(`/api/teacher/criteria/${id}`).then((r) => r.data),
  loadStandardCriteria: () => api.post('/api/teacher/criteria/load-standard').then((r) => r.data),
};

export const adminApi = {
  stats: () => api.get('/api/admin/stats').then((r) => r.data),
  users: () => api.get('/api/admin/users').then((r) => r.data),
  createUser: (data) => api.post('/api/admin/users', data).then((r) => r.data),
  updateUser: (id, data) => api.put(`/api/admin/users/${id}`, data).then((r) => r.data),
  deleteUser: (id) => api.delete(`/api/admin/users/${id}`).then((r) => r.data),
  toggleUser: (id) => api.post(`/api/admin/users/${id}/toggle`).then((r) => r.data),
  departments: () => api.get('/api/admin/departments').then((r) => r.data),
  createDepartment: (data) => api.post('/api/admin/departments', data).then((r) => r.data),
  subjects: () => api.get('/api/admin/subjects').then((r) => r.data),
  createSubject: (data) => api.post('/api/admin/subjects', data).then((r) => r.data),
  deleteSubject: (id) => api.delete(`/api/admin/subjects/${id}`).then((r) => r.data),
  groups: () => api.get('/api/admin/groups').then((r) => r.data),
  groupActivity: () => api.get('/api/admin/group-activity').then((r) => r.data),
  createGroup: (data) => api.post('/api/admin/groups', data).then((r) => r.data),
  updateGroup: (id, data) => api.put(`/api/admin/groups/${id}`, data).then((r) => r.data),
  deleteGroup: (id) => api.delete(`/api/admin/groups/${id}`).then((r) => r.data),
  groupStudents: (id) => api.get(`/api/admin/groups/${id}/students`).then((r) => r.data),
  addGroupStudent: (id, data) => api.post(`/api/admin/groups/${id}/students`, data).then((r) => r.data),
  removeGroupStudent: (gid, sid) => api.delete(`/api/admin/groups/${gid}/students/${sid}`).then((r) => r.data),
  availableStudents: () => api.get('/api/admin/available-students').then((r) => r.data),
  teachers: () => api.get('/api/admin/teachers').then((r) => r.data),
  news: () => api.get('/api/admin/news').then((r) => r.data),
  createNews: (data) => api.post('/api/admin/news', data).then((r) => r.data),
  updateNews: (id, data) => api.put(`/api/admin/news/${id}`, data).then((r) => r.data),
  deleteNews: (id) => api.delete(`/api/admin/news/${id}`).then((r) => r.data),
  settings: () => api.get('/api/admin/settings').then((r) => r.data),
  saveSettings: (data) => api.post('/api/admin/settings', data).then((r) => r.data),
  logs: () => api.get('/api/admin/activity-logs').then((r) => r.data),
  leaderboard: () => api.get('/api/admin/stats/leaderboard').then((r) => r.data),
  notifications: () => api.get('/api/admin/notifications').then((r) => r.data),
  readNotification: (id) => api.post(`/api/admin/notifications/${id}/read`).then((r) => r.data),
  readAllNotifications: () => api.post('/api/admin/notifications/read-all').then((r) => r.data),
};
