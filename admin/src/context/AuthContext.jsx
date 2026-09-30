import React, { createContext, useContext, useMemo, useState } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
  } catch (error) {
    return null;
  }
};

const readStoredToken = () => localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readStoredToken);
  const [user, setUser] = useState(readStoredUser);

  const login = async (credentials, options = {}) => {
    const response = await authService.login(credentials);

    if (response?.token && response?.user) {
      const storage = options.rememberMe ? localStorage : sessionStorage;
      const secondaryStorage = options.rememberMe ? sessionStorage : localStorage;

      secondaryStorage.removeItem('authToken');
      secondaryStorage.removeItem('user');
      storage.setItem('authToken', response.token);
      storage.setItem('user', JSON.stringify(response.user));
      setToken(response.token);
      setUser(response.user);
    }

    return response;
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      role: user?.role || null,
      orgId: user?.orgId || null,
      organizationName: user?.organizationName || '',
      isAuthenticated: Boolean(token && user),
      login,
      logout,
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
