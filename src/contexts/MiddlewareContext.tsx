import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { middlewareClient } from '@/services/middlewareClient';

type Status = 'connecting' | 'online' | 'offline';

interface MiddlewareContextType {
  status: Status;
  isOnline: boolean;
  connected: boolean;       // fix.connected
  loggedIn: boolean;        // fix.loggedIn (legacy alias: fixLoggedIn)
  fixLoggedIn: boolean;
  csdConnected: boolean;    // csd.connected
  instrumentCount: number;
  lastChecked: Date | null;
  refresh: () => void;
}

const MiddlewareContext = createContext<MiddlewareContextType>({
  status: 'connecting',
  isOnline: false,
  connected: false,
  loggedIn: false,
  fixLoggedIn: false,
  csdConnected: false,
  instrumentCount: 0,
  lastChecked: null,
  refresh: () => {},
});

export function MiddlewareProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('connecting');
  const [connected, setConnected] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [csdConnected, setCsdConnected] = useState(false);
  const [instrumentCount, setInstrumentCount] = useState(0);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  async function checkHealth() {
    try {
      // Single source of truth: GET /health (no /api prefix).
      // Returns { status, fix: { connected, loggedIn, ... }, csd: { connected, ... }, instruments? }
      const data: any = await middlewareClient.health();
      const fixConnected = data?.fix?.connected === true;
      const fixLoggedIn = data?.fix?.loggedIn === true;
      const csdOk = data?.csd?.connected === true;
      const instCount = Number(data?.instruments ?? data?.instrumentCount ?? 0);

      setConnected(fixConnected);
      setLoggedIn(fixLoggedIn);
      setCsdConnected(csdOk);
      setInstrumentCount(isNaN(instCount) ? 0 : instCount);

      if (data?.status === 'ok' && fixLoggedIn) {
        setStatus('online');
      } else if (fixConnected || csdOk) {
        setStatus('online');
      } else {
        setStatus('offline');
      }
    } catch {
      setStatus('offline');
      setConnected(false);
      setLoggedIn(false);
      setCsdConnected(false);
    }
    setLastChecked(new Date());
  }

  useEffect(() => {
    const initTimer = setTimeout(checkHealth, 1500);
    intervalRef.current = setInterval(checkHealth, 30000);

    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalRef.current);
      } else {
        checkHealth();
        intervalRef.current = setInterval(checkHealth, 30000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearTimeout(initTimer);
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <MiddlewareContext.Provider
      value={{
        status,
        isOnline: status === 'online',
        connected,
        loggedIn,
        fixLoggedIn: loggedIn,
        csdConnected,
        instrumentCount,
        lastChecked,
        refresh: checkHealth,
      }}
    >
      {children}
    </MiddlewareContext.Provider>
  );
}

export const useMiddleware = () => useContext(MiddlewareContext);
