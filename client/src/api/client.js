import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const KEY = 'tf_token';

// "Remember me" -> localStorage (30 days); otherwise sessionStorage (until the tab closes)
export const getToken = () => localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
export const setToken = (token, remember = true) => {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(KEY, token);
};
export const clearToken = () => {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
};

const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthCall = err.config?.url?.startsWith('/auth/login') || err.config?.url?.startsWith('/auth/register');
    if (err.response?.status === 401 && !isAuthCall) {
      clearToken();
      window.dispatchEvent(new Event('tf:logout'));
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong';
export default api;
