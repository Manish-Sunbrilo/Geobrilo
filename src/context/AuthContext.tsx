import React, { createContext, useContext, useEffect, useState } from 'react';
import { clearSession, getSession, isProvisioned, saveSession } from '../services/storage';
import { insertAuditEvent, E_LOGIN, E_LOGOUT } from '../db/auditEventsRepo';
import { syncUnsyncedAuditEvents } from '../services/syncService';
import { formatIstDateTime } from '../utils/datetime';
import type { SUser } from '../types/auth';

type AuthContextValue = {
  user: SUser | null;
  initializing: boolean;
  provisioned: boolean;
  setUser: (user: SUser) => Promise<void>;
  markSignedUp: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<SUser | null>(null);
  const [provisioned, setProvisioned] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      const [session, provisionedFlag] = await Promise.all([getSession(), isProvisioned()]);
      setUserState(session);
      setProvisioned(provisionedFlag);
      setInitializing(false);
    })();
  }, []);

  const setUser = async (nextUser: SUser) => {
    await saveSession(nextUser);
    setUserState(nextUser);
    if (nextUser.userid) {
      insertAuditEvent(E_LOGIN, formatIstDateTime(), nextUser.userid, '', '')
        .then(() => syncUnsyncedAuditEvents())
        .catch(() => undefined);
    }
  };

  const markSignedUp = () => setProvisioned(true);

  const logout = async () => {
    if (user?.userid) {
      try {
        await insertAuditEvent(E_LOGOUT, formatIstDateTime(), user.userid, '', '');
        await syncUnsyncedAuditEvents();
      } catch {
        // Best-effort -- still proceed with logout below even if this fails.
      }
    }
    await clearSession();
    setUserState(null);
  };

  return (
    <AuthContext.Provider value={{ user, initializing, provisioned, setUser, markSignedUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
