import { useState, useCallback, useEffect } from 'react';

export interface PriceAlert {
  id: string;
  stockSymbol: string;
  targetPrice: number;
  direction: 'above' | 'below' | 'at';
  createdAt: string;
  triggeredAt: string | null;
}

export function usePriceAlerts(stockSymbol: string) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`circle_alerts_${stockSymbol}`);
      if (stored) setAlerts(JSON.parse(stored));
      else setAlerts([]);
    } catch { setAlerts([]); }
  }, [stockSymbol]);

  const save = useCallback((a: PriceAlert[]) => {
    try { localStorage.setItem(`circle_alerts_${stockSymbol}`, JSON.stringify(a)); } catch {}
  }, [stockSymbol]);

  const addAlert = useCallback((targetPrice: number, direction: 'above' | 'below' | 'at') => {
    const alert: PriceAlert = {
      id: crypto.randomUUID(),
      stockSymbol,
      targetPrice,
      direction,
      createdAt: new Date().toISOString(),
      triggeredAt: null,
    };
    setAlerts(prev => {
      const next = [...prev, alert];
      save(next);
      return next;
    });
  }, [stockSymbol, save]);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => {
      const next = prev.filter(a => a.id !== id);
      save(next);
      return next;
    });
  }, [save]);

  const activeAlerts = alerts.filter(a => !a.triggeredAt);
  const triggeredAlerts = alerts.filter(a => !!a.triggeredAt);

  return { alerts, activeAlerts, triggeredAlerts, addAlert, removeAlert };
}
