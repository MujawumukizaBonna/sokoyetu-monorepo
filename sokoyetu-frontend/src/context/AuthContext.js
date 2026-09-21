import { createContext, useContext, useState, useEffect } from 'react';
import { getMe, SESSION_ENDED_EVENT } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe()
        .then((res) => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // A revoked session - a password change on another device, or an expired token -
  // is announced by the API client. Dropping the user here lets the router send
  // them back to sign-in rather than leaving them on a screen that cannot load.
  useEffect(() => {
    const handleSessionEnded = () => setUser(null);
    window.addEventListener(SESSION_ENDED_EVENT, handleSessionEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, handleSessionEnded);
  }, []);

  const loginUser = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logoutUser = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Lets a screen push back a freshly saved profile so the rest of the app
  // (greetings, nav) reflects the change without a full reload.
  const updateUser = (userData) => setUser(userData);

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logoutUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
