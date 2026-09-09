import React, { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { OrderBookEngine } from '@/lib/ats/orderBookEngine';
import { ATS_SECURITIES } from '@/lib/ats/mockSecurities';
import { runOpeningAuction } from '@/lib/ats/openingAuction';
import { calculateClosingVWAP } from '@/lib/ats/closingVWAP';
import { useSessionController } from '@/hooks/useSessionController';
import { Order, SessionState, Security, Trade, OrderBook, HaltType } from '@/lib/ats/types';

interface ATSContextValue {
  engine: OrderBookEngine;
  session: SessionState;
  timeToNextSession: number;
  isMarketOpen: boolean;
  haltState: HaltType;
  setHalt: (halt: HaltType) => void;
  securities: Security[];
  addOrder: (order: Omit<Order, 'id' | 'timestamp' | 'filledQuantity' | 'status' | 'rejectionReason'>) => Order;
  cancelOrder: (orderId: string) => boolean;
  amendOrder: (orderId: string, newPrice?: number, newQuantity?: number) => Order | null;
  getOrderBook: (securityId: string) => OrderBook;
  getAllTrades: () => Trade[];
  getAllOrders: () => Order[];
  getNewTrades: () => Trade[];
}

const ATSContext = createContext<ATSContextValue | null>(null);

export function ATSProvider({ children }: { children: React.ReactNode }) {
  const engineRef = useRef(new OrderBookEngine(ATS_SECURITIES));
  const prevSessionRef = useRef<SessionState>('CLOSED');
  const { session, timeToNextSession, isMarketOpen, haltState, setHalt } = useSessionController();

  const engine = engineRef.current;
  useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.getAllOrders().length + engine.getAllTrades().length
  );

  useEffect(() => {
    const prev = prevSessionRef.current;
    if (session === 'PRE_OPEN' && prev !== 'PRE_OPEN') {
      for (const sec of engine.getSecurities()) engine.updateSecurityStatus(sec.id, 'PRE_OPEN');
    }
    if (session === 'OPENING_AUCTION' && prev !== 'OPENING_AUCTION') {
      for (const sec of engine.getSecurities()) {
        const book = engine.getOrderBook(sec.id);
        const security = engine.getSecurity(sec.id);
        if (security) { runOpeningAuction(sec.id, book, security); engine.updateSecurityStatus(sec.id, 'OPEN'); }
      }
    }
    if (session === 'CONTINUOUS' && prev !== 'CONTINUOUS') {
      for (const sec of engine.getSecurities()) engine.updateSecurityStatus(sec.id, 'OPEN');
    }
    if (session === 'CLOSED' && prev === 'CONTINUOUS') {
      const allTrades = engine.getAllTrades();
      for (const sec of engine.getSecurities()) {
        calculateClosingVWAP(sec.id, allTrades, sec);
        engine.updateSecurityStatus(sec.id, 'CLOSED');
      }
    }
    prevSessionRef.current = session;
  }, [session, engine]);

  const value: ATSContextValue = {
    engine, session, timeToNextSession, isMarketOpen, haltState, setHalt,
    securities: engine.getSecurities(),
    addOrder: (order) => engine.addOrder(order, session),
    cancelOrder: (id) => engine.cancelOrder(id),
    amendOrder: (id, price, qty) => engine.amendOrder(id, price, qty, session),
    getOrderBook: (secId) => engine.getOrderBook(secId),
    getAllTrades: () => engine.getAllTrades(),
    getAllOrders: () => engine.getAllOrders(),
    getNewTrades: () => engine.getNewTrades(),
  };

  return <ATSContext.Provider value={value}>{children}</ATSContext.Provider>;
}

export function useATS() {
  const ctx = useContext(ATSContext);
  if (!ctx) throw new Error('useATS must be used within ATSProvider');
  return ctx;
}
