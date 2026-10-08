import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types/auth';

/** A hospital a platform admin has stepped into. */
export interface ClinicContext {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** Set when a platform admin is working inside a client hospital. */
  clinicContext: ClinicContext | null;
  enterClinic: (clinic: ClinicContext) => void;
  exitClinic: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'hms_token';
const USER_KEY = 'hms_user';
const CLINIC_KEY = 'hms_clinic_context';

/**
 * Sessions live in sessionStorage, which is scoped to a single browser tab.
 *
 * localStorage is shared across every tab on the origin, so signing in as the
 * doctor in one tab overwrote the receptionist's token in another, and
 * refreshing the first tab brought it back as the doctor. A hospital is worked
 * from several screens at once — the front desk, the consulting room, the
 * pharmacy counter — and on a shared terminal those are often tabs of one
 * browser. Per-tab storage keeps each signed in as themselves, still surviving
 * a refresh; the trade is that closing a tab ends that session, which on a
 * shared machine is the safer default anyway.
 */
const session = {
  get(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null; // Private-mode or storage-disabled: fall back to a memory-only session.
    }
  },
  set(key: string, value: string) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* Non-fatal — the session simply won't survive a refresh. */
    }
  },
  remove(key: string) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Nothing to clear. */
    }
  },
};

// Clear tokens written by the previous localStorage-based build, so a stale
// shared token can't resurrect itself into a tab that should be signed out.
try {
  [TOKEN_KEY, USER_KEY, CLINIC_KEY].forEach((k) => localStorage.removeItem(k));
} catch {
  /* Storage unavailable — nothing to migrate. */
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicContext, setClinicContext] = useState<ClinicContext | null>(() => {
    const saved = session.get(CLINIC_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  // On mount: restore this tab's session and validate it with /api/auth/me
  useEffect(() => {
    const savedToken = session.get(TOKEN_KEY);
    const savedUser = session.get(USER_KEY);

    if (!savedToken || !savedUser) {
      setLoading(false);
      return;
    }

    setToken(savedToken);

    // Validate token against backend
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Token expired');
        return res.json();
      })
      .then((userData) => {
        setUser(userData);
        session.set(USER_KEY, JSON.stringify(userData));
      })
      .catch(() => {
        // Token invalid — clear everything
        session.remove(TOKEN_KEY);
        session.remove(USER_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    session.set(TOKEN_KEY, newToken);
    session.set(USER_KEY, JSON.stringify(newUser));
  };

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setClinicContext(null);
    session.remove(TOKEN_KEY);
    session.remove(USER_KEY);
    session.remove(CLINIC_KEY);
  }, []);

  const enterClinic = useCallback((clinic: ClinicContext) => {
    setClinicContext(clinic);
    session.set(CLINIC_KEY, JSON.stringify(clinic));
  }, []);

  const exitClinic = useCallback(() => {
    setClinicContext(null);
    session.remove(CLINIC_KEY);
  }, []);

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'MASTER') return true;
    return roles.includes(user.role);
  };

  /** Wraps fetch to auto-logout on 401 responses (expired/invalid token) */
  const apiFetch = useCallback(
    async (url: string, options?: RequestInit): Promise<Response> => {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          Authorization: `Bearer ${token}`,
          ...(clinicContext ? { 'x-clinic-id': clinicContext.id } : {}),
        },
      });

      if (res.status === 401) {
        logout();
      }

      return res;
    },
    [token, logout, clinicContext],
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole, apiFetch, clinicContext, enterClinic, exitClinic }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
