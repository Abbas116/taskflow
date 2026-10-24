import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { clearToken, getToken, setToken } from '../api/client';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  // restore session on page load
  useEffect(() => {
    if (!getToken()) return;
    api.get('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // the axios interceptor fires this when the API answers 401
  useEffect(() => {
    window.addEventListener('tf:logout', logout);
    return () => window.removeEventListener('tf:logout', logout);
  }, [logout]);

  const login = async (email, password, remember) => {
    const { data } = await api.post('/auth/login', { email, password, remember });
    setToken(data.token, remember);
    setUser(data.user);
  };

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    setToken(data.token, true);
    setUser(data.user);
  };

  return <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}
