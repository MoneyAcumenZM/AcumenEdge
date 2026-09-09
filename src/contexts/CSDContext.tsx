import React, { createContext, useContext, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { CSDEngine } from '@/lib/csd/csdEngine';
import { CSDAccount, CSDHolding, CSDClearance, CSDSettlement, SWIFTMessage, CSDCommunicationLog, Order, Security } from '@/lib/ats/types';

interface CSDContextValue {
  accounts: CSDAccount[];
  getAccount: (number: string) => CSDAccount | undefined;
  getHoldings: (accountNumber: string) => CSDHolding[];
  getHolding: (accountNumber: string, securityId: string) => CSDHolding | undefined;
  refreshHoldings: (accountNumber: string) => Promise<void>;
  requestClearance: (order: Partial<Order>, account: CSDAccount, security: Security) => Promise<CSDClearance>;
  validateAccount: (accountNumber: string, brokerId: string) => { valid: boolean; reason: string | null; account?: CSDAccount };
  checkAndReserveHoldings: (accountNumber: string, securityId: string, quantity: number) => { sufficient: boolean; available: number; reserved: boolean };
  releaseReservation: (accountNumber: string, securityId: string, quantity: number) => void;
  processTradeSettlement: (trade: any, buyerAccount: string, sellerAccount: string, security: Security, board: any) => Promise<CSDSettlement>;
  settlements: CSDSettlement[];
  getPendingSettlements: () => CSDSettlement[];
  getSettlementForTrade: (tradeId: string) => CSDSettlement | undefined;
  swiftMessages: SWIFTMessage[];
  communicationLog: CSDCommunicationLog[];
  clearances: CSDClearance[];
  csdConnectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED';
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
}

const CSDContext = createContext<CSDContextValue | null>(null);

export function CSDProvider({ children }: { children: React.ReactNode }) {
  const engineRef = useRef(new CSDEngine());
  const [isProcessing, setIsProcessing] = useState(false);
  const engine = engineRef.current;

  useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.getAllSWIFTMessages().length + engine.getAllSettlements().length + engine.getCommunicationLog().length + engine.getAllClearances().length
  );

  const refreshHoldings = useCallback(async (accountNumber: string) => {
    setIsProcessing(true);
    await engine.requestHoldingsStatement(accountNumber);
    setIsProcessing(false);
  }, [engine]);

  const requestClearance = useCallback(async (order: Partial<Order>, account: CSDAccount, security: Security) => {
    return engine.sendPreTradeNotification(order, account, security);
  }, [engine]);

  const value: CSDContextValue = {
    accounts: engine.getAccounts(),
    getAccount: (n) => engine.getAccount(n),
    getHoldings: (n) => engine.getHoldings(n),
    getHolding: (n, s) => engine.getHolding(n, s),
    refreshHoldings,
    requestClearance,
    validateAccount: (n, b) => engine.validateAccount(n, b),
    checkAndReserveHoldings: (n, s, q) => engine.checkAndReserveHoldings(n, s, q),
    releaseReservation: (n, s, q) => engine.releaseReservation(n, s, q),
    processTradeSettlement: (t, b, s, sec, board) => engine.processTradeSettlement(t, b, s, sec, board),
    settlements: engine.getAllSettlements(),
    getPendingSettlements: () => engine.getPendingSettlements(),
    getSettlementForTrade: (t) => engine.getSettlement(t),
    swiftMessages: engine.getAllSWIFTMessages(),
    communicationLog: engine.getCommunicationLog(),
    clearances: engine.getAllClearances(),
    csdConnectionStatus: 'CONNECTED',
    isProcessing,
    setIsProcessing,
  };

  return <CSDContext.Provider value={value}>{children}</CSDContext.Provider>;
}

export function useCSD() {
  const ctx = useContext(CSDContext);
  if (!ctx) throw new Error('useCSD must be used within CSDProvider');
  return ctx;
}
