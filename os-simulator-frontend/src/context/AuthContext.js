import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (t) => {
    try {
      const res = await api.get('/auth/me', { headers: { Authorization: `Bearer ${t}` } });
      setUser(res.data.user);
    } catch {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchMe(token);
    else setLoading(false);
  }, [token, fetchMe]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: t, user: u } = res.data;
    localStorage.setItem('token', t);
    setToken(t);
    setUser(u);
    return u;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    const { token: t, user: u } = res.data;
    localStorage.setItem('token', t);
    setToken(t);
    setUser(u);
    return u;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  // Deep merge so avatar object is fully replaced
  const updateUser = (updates) => setUser(prev => ({ ...prev, ...updates }));

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#050a14', flexDirection: 'column', gap: 16,
      }}>
        <img src="/logo.png" alt="OS Kernel Simulator" style={{ width: 72, height: 72, borderRadius: 16 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#00c8ff', fontFamily: 'monospace', fontSize: 14 }}>
          <div className="spinner" />
          Initializing Kernel...
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
