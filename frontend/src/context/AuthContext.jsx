import { createContext, useContext, useState, useEffect } from 'react';
import { getUser, getToken, clearSession, setSession } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(getUser);
  const [loading, setLoading] = useState(false);

  function login(sessionData) {
    setSession(sessionData);
    setUser(sessionData.user);
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  function updateUser(newUser) {
    setUser(newUser);
    const session = JSON.parse(localStorage.getItem('ag_session') || '{}');
    if (session) {
      session.user = newUser;
      localStorage.setItem('ag_session', JSON.stringify(session));
    }
  }

  const isAuthenticated = !!user && !!getToken();

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, updateUser, loading, setLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
