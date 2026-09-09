import {
  CSDAccount, CSDHolding, CSDClearance, CSDSettlement,
  SWIFTMessage, SWIFTMessageType, SWIFTPayload, CSDCommunicationLog,
  Order, Security, Trade, Board,
} from '../ats/types';
import { MOCK_CSD_ACCOUNTS, MOCK_CSD_HOLDINGS, CSD_BIC, BROKER_BIC } from '../ats/mockSecurities';
import { buildMT541, buildMT543, buildMT548, buildMT535 } from './swiftMessageBuilder';

let clearanceCounter = 0;
let settlementCounter = 0;
let swiftCounter = 0;
let logCounter = 0;

function genClearanceId(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `CLR-${d}-${String(++clearanceCounter).padStart(6, '0')}`;
}
function genSettlementId(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `SET-${d}-${String(++settlementCounter).padStart(6, '0')}`;
}
function genSwiftId(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `SWIFT-${d}-${String(++swiftCounter).padStart(6, '0')}`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(): number {
  return 800 + Math.random() * 1200;
}

interface CSDValidationResult {
  valid: boolean;
  reason: string | null;
  account?: CSDAccount;
}

interface CSDHoldingsResult {
  sufficient: boolean;
  available: number;
  reserved: boolean;
}

interface CSDCrossingValidation {
  valid: boolean;
  reason: string | null;
}

export class CSDEngine {
  private accounts: CSDAccount[];
  private holdings: CSDHolding[];
  private clearances: CSDClearance[] = [];
  private settlements: CSDSettlement[] = [];
  private swiftMessages: SWIFTMessage[] = [];
  private communicationLog: CSDCommunicationLog[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.accounts = MOCK_CSD_ACCOUNTS.map(a => ({ ...a }));
    this.holdings = MOCK_CSD_HOLDINGS.map(h => ({ ...h }));
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private notify() { for (const l of this.listeners) l(); }

  // STEP 1: Account validation
  validateAccount(accountNumber: string, brokerId: string): CSDValidationResult {
    const account = this.accounts.find(a => a.accountNumber === accountNumber);
    if (!account) return { valid: false, reason: 'CSD account not found' };
    if (account.accountStatus === 'FROZEN') return { valid: false, reason: `Account ${accountNumber} is frozen. Contact CSD Operations.` };
    if (account.accountStatus === 'SUSPENDED') return { valid: false, reason: `Account ${accountNumber} is suspended` };
    if (account.accountStatus === 'CLOSED') return { valid: false, reason: `Account ${accountNumber} is closed` };
    if (account.brokerId !== brokerId) return { valid: false, reason: 'Account not registered under your brokerage' };
    return { valid: true, reason: null, account };
  }

  // STEP 2: Holdings check for SELL
  checkAndReserveHoldings(accountNumber: string, securityId: string, quantity: number): CSDHoldingsResult {
    const holding = this.holdings.find(h => h.accountNumber === accountNumber && h.securityId === securityId);
    if (!holding || !holding.isCSDDeposited) return { sufficient: false, available: 0, reserved: false };
    if (holding.availableQuantity < quantity) return { sufficient: false, available: holding.availableQuantity, reserved: false };

    holding.availableQuantity -= quantity;
    holding.reservedQuantity += quantity;
    this.notify();
    return { sufficient: true, available: holding.availableQuantity, reserved: true };
  }

  // STEP 3: SWIFT pre-trade notification
  async sendPreTradeNotification(order: Partial<Order>, account: CSDAccount, security: Security): Promise<CSDClearance> {
    const messageId = genSwiftId();
    const clearanceId = genClearanceId();
    const isBuy = order.side === 'BUY';
    const settlementDays = order.board === 'DEBT' ? 2 : 3;
    const settlementDate = new Date();
    settlementDate.setDate(settlementDate.getDate() + settlementDays);

    const payload: SWIFTPayload = {
      isinCode: security.isinCode,
      quantity: order.quantity,
      price: order.price ?? undefined,
      settlementDate: settlementDate.toISOString().slice(0, 10).replace(/-/g, ''),
      buyerAccount: isBuy ? account.accountNumber : undefined,
      sellerAccount: !isBuy ? account.accountNumber : undefined,
      brokerCode: BROKER_BIC,
      securityDescription: security.name,
      currency: 'ZMW',
      settlementAmount: (order.quantity || 0) * (order.price || 0),
    };

    const rawMessage = isBuy ? buildMT541(payload, messageId) : buildMT543(payload, messageId);
    const messageType: SWIFTMessageType = isBuy ? 'MT541' : 'MT543';

    const swiftMsg: SWIFTMessage = {
      messageId, messageType, sender: BROKER_BIC, receiver: CSD_BIC,
      timestamp: new Date(), status: 'QUEUED', payload, acknowledgementTime: null, rawMessage,
    };
    this.swiftMessages.push(swiftMsg);
    this.addLog('OUTBOUND', messageType, messageId, account.accountNumber, security.id, 'PENDING', `${messageType} sent for ${order.side} ${order.quantity} ${security.ticker}`);
    this.notify();

    // Simulate network delay
    await delay(randomDelay());
    swiftMsg.status = 'SENT';
    this.notify();

    await delay(randomDelay());

    // 95% success rate
    const success = Math.random() > 0.05;
    swiftMsg.status = success ? 'ACKNOWLEDGED' : 'REJECTED';
    swiftMsg.acknowledgementTime = new Date();

    const clearance: CSDClearance = {
      clearanceId, orderId: '', accountNumber: account.accountNumber,
      securityId: security.id, side: order.side as 'BUY' | 'SELL',
      quantity: order.quantity || 0, requestedAt: new Date(),
      clearedAt: success ? new Date() : null,
      status: success ? 'CLEARED' : 'REJECTED',
      rejectionReason: success ? null : 'CSD clearance denied',
      swiftMessageId: messageId,
      expiryTime: new Date(Date.now() + 30 * 60 * 1000),
    };

    this.clearances.push(clearance);
    this.addLog('INBOUND', success ? (isBuy ? 'MT545' : 'MT547') : 'MT548', messageId, account.accountNumber, security.id, success ? 'SUCCESS' : 'FAILED', success ? `Clearance ${clearanceId} granted` : 'CSD clearance rejected');
    this.notify();
    return clearance;
  }

  // STEP 4: Release reservation
  releaseReservation(accountNumber: string, securityId: string, quantity: number): void {
    const holding = this.holdings.find(h => h.accountNumber === accountNumber && h.securityId === securityId);
    if (holding) {
      holding.reservedQuantity = Math.max(0, holding.reservedQuantity - quantity);
      holding.availableQuantity += quantity;
      this.notify();
    }
  }

  // STEP 5: Post-trade settlement
  async processTradeSettlement(trade: Trade, buyerAccount: string, sellerAccount: string, security: Security, board: Board): Promise<CSDSettlement> {
    const settlementDays = board === 'DEBT' ? 2 : 3;
    const settlementDate = new Date();
    settlementDate.setDate(settlementDate.getDate() + settlementDays);

    const messageId = genSwiftId();
    const settlement: CSDSettlement = {
      settlementId: genSettlementId(), tradeId: trade.id,
      buyerAccount, sellerAccount, securityId: security.id,
      isinCode: security.isinCode, quantity: trade.quantity,
      executionPrice: trade.executionPrice,
      settlementAmount: trade.quantity * trade.executionPrice,
      settlementDate, status: 'PENDING', swiftMessageId: messageId,
      createdAt: new Date(), settledAt: null,
    };

    this.settlements.push(settlement);

    const payload: SWIFTPayload = {
      tradeReference: trade.id, isinCode: security.isinCode,
      quantity: trade.quantity, price: trade.executionPrice,
      settlementDate: settlementDate.toISOString().slice(0, 10).replace(/-/g, ''),
      buyerAccount, sellerAccount, currency: 'ZMW',
      settlementAmount: settlement.settlementAmount,
      securityDescription: security.name,
    };

    const rawMessage = buildMT548(payload, messageId);
    const swiftMsg: SWIFTMessage = {
      messageId, messageType: 'MT548', sender: BROKER_BIC, receiver: CSD_BIC,
      timestamp: new Date(), status: 'SENT', payload, acknowledgementTime: null, rawMessage,
    };
    this.swiftMessages.push(swiftMsg);
    this.addLog('OUTBOUND', 'MT548', messageId, buyerAccount, security.id, 'PENDING', `Settlement notification for trade ${trade.id}`);
    this.notify();

    await delay(randomDelay());
    swiftMsg.status = 'ACKNOWLEDGED';
    swiftMsg.acknowledgementTime = new Date();

    // Update holdings
    const buyerHolding = this.holdings.find(h => h.accountNumber === buyerAccount && h.securityId === security.id);
    if (buyerHolding) {
      buyerHolding.totalQuantity += trade.quantity;
      buyerHolding.availableQuantity += trade.quantity;
      buyerHolding.currentMarketValue = buyerHolding.totalQuantity * trade.executionPrice;
    } else {
      this.holdings.push({
        accountNumber: buyerAccount, securityId: security.id, securityName: security.name,
        isinCode: security.isinCode, totalQuantity: trade.quantity, availableQuantity: trade.quantity,
        reservedQuantity: 0, averageCostPrice: trade.executionPrice,
        currentMarketValue: trade.quantity * trade.executionPrice,
        depositDate: new Date(), isCSDDeposited: true,
      });
    }

    const sellerHolding = this.holdings.find(h => h.accountNumber === sellerAccount && h.securityId === security.id);
    if (sellerHolding) {
      sellerHolding.totalQuantity -= trade.quantity;
      sellerHolding.reservedQuantity = Math.max(0, sellerHolding.reservedQuantity - trade.quantity);
      sellerHolding.currentMarketValue = sellerHolding.totalQuantity * trade.executionPrice;
    }

    this.addLog('INBOUND', 'MT547', messageId, buyerAccount, security.id, 'SUCCESS', `Settlement confirmed for trade ${trade.id}`);
    this.notify();
    return settlement;
  }

  // STEP 6: Crossing validation
  validateCrossing(buyerAccount: string, sellerAccount: string, securityId: string, quantity: number, price: number, issuedQuantity: number): CSDCrossingValidation {
    const buyer = this.validateAccount(buyerAccount, 'broker-infinity-001');
    if (!buyer.valid) return { valid: false, reason: `Buyer: ${buyer.reason}` };
    const seller = this.validateAccount(sellerAccount, 'broker-infinity-001');
    if (!seller.valid) return { valid: false, reason: `Seller: ${seller.reason}` };

    const sellerHolding = this.holdings.find(h => h.accountNumber === sellerAccount && h.securityId === securityId);
    if (!sellerHolding || sellerHolding.availableQuantity < quantity) {
      return { valid: false, reason: `Seller insufficient holdings. Available: ${sellerHolding?.availableQuantity ?? 0}` };
    }

    const crossingValue = quantity * price;
    const pctOfIssued = (quantity / issuedQuantity) * 100;
    if (crossingValue <= 1000 && pctOfIssued <= 2) {
      return { valid: false, reason: 'Crossing requires value > K1,000 OR quantity > 2% of issued' };
    }

    return { valid: true, reason: null };
  }

  // STEP 7: Holdings statement
  async requestHoldingsStatement(accountNumber: string): Promise<CSDHolding[]> {
    const messageId = genSwiftId();
    const holdings = this.holdings.filter(h => h.accountNumber === accountNumber);

    const payload: SWIFTPayload = { buyerAccount: accountNumber, currency: 'ZMW' };
    const rawMessage = buildMT535(payload, messageId);
    const swiftMsg: SWIFTMessage = {
      messageId, messageType: 'MT535', sender: CSD_BIC, receiver: BROKER_BIC,
      timestamp: new Date(), status: 'SENT', payload, acknowledgementTime: null, rawMessage,
    };
    this.swiftMessages.push(swiftMsg);
    this.addLog('OUTBOUND', 'MT537', messageId, accountNumber, '', 'PENDING', 'Holdings statement requested');
    this.notify();

    await delay(randomDelay());
    swiftMsg.status = 'ACKNOWLEDGED';
    swiftMsg.acknowledgementTime = new Date();
    this.addLog('INBOUND', 'MT535', messageId, accountNumber, '', 'SUCCESS', `Holdings statement received: ${holdings.length} positions`);
    this.notify();
    return holdings;
  }

  // Getters
  getAccount(accountNumber: string): CSDAccount | undefined { return this.accounts.find(a => a.accountNumber === accountNumber); }
  getAccounts(): CSDAccount[] { return [...this.accounts]; }
  getHoldings(accountNumber: string): CSDHolding[] { return this.holdings.filter(h => h.accountNumber === accountNumber); }
  getHolding(accountNumber: string, securityId: string): CSDHolding | undefined { return this.holdings.find(h => h.accountNumber === accountNumber && h.securityId === securityId); }
  getClearance(clearanceId: string): CSDClearance | undefined { return this.clearances.find(c => c.clearanceId === clearanceId); }
  getSettlement(tradeId: string): CSDSettlement | undefined { return this.settlements.find(s => s.tradeId === tradeId); }
  getAllSettlements(): CSDSettlement[] { return [...this.settlements]; }
  getPendingSettlements(): CSDSettlement[] { return this.settlements.filter(s => s.status === 'PENDING'); }
  getAllSWIFTMessages(): SWIFTMessage[] { return [...this.swiftMessages]; }
  getCommunicationLog(): CSDCommunicationLog[] { return [...this.communicationLog]; }
  getAllClearances(): CSDClearance[] { return [...this.clearances]; }

  private addLog(direction: 'OUTBOUND' | 'INBOUND', messageType: SWIFTMessageType, messageId: string, accountNumber: string, securityId: string, status: 'SUCCESS' | 'FAILED' | 'PENDING', summary: string) {
    this.communicationLog.push({
      id: `log-${++logCounter}`, timestamp: new Date(), direction, messageType, messageId, accountNumber, securityId, status, summary,
    });
  }
}
