import axios from 'axios';
import { getLang } from '../i18n';

// Empty baseURL => same-origin (works with the dev proxy and single-service prod deploy)
const baseURL = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Tells the backend which language to answer errors and AI feedback in.
  config.headers['Accept-Language'] = getLang();
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
