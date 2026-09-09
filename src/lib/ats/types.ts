// SIMULATION / DISPLAY ONLY — this module never determines what a user believes filled.
// Real fills come only from the exchange via fix-bridge-webhook.

// LuSE ATS (Automated Trading System) Types

export type Board = 'EQUITY' | 'ODD_LOT' | 'DEBT' | 'CROSSING';
export type SessionState = 'PRE_OPEN' | 'OPENING_AUCTION' | 'CONTINUOUS' | 'CLOSED';
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';
export type TimeInForce = 'DAY' | 'GTD' | 'IOC';
export type Qualifier = 'NONE' | 'FOK' | 'FAK' | 'GTD' | 'IOC';
export type OrderStatus = 'PENDING' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED';
export type TradingStatus = 'PRE_OPEN' | 'OPEN' | 'HALTED' | 'SUSPENDED' | 'CLOSED';
export type HaltType = 'MARKET_HALT' | 'SECURITY_HALT' | null;

export interface Security {
  id: string;
  name: string;
  ticker: string;
  board: Board;
  lastClosingPrice: number;
  priceSpreadLimit: number;
  tickSize: number;
  tradingStatus: TradingStatus;
  isNewlyListed: boolean;
  currentVWAP: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  totalVolume: number;
  lastPrice: number | null;
  isinCode: string;
  sector: string;
}

export interface Order {
  id: string;
  securityId: string;
  clientAccount: string;
  brokerId: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  filledQuantity: number;
  price: number | null;
  timeInForce: TimeInForce;
  expiryDate: Date | null;
  qualifier: Qualifier;
  disclosedQuantity: number | null;
  hiddenQuantity: number | null;
  status: OrderStatus;
  timestamp: Date;
  board: Board;
  rejectionReason: string | null;
  csdClearanceId?: string;
}

export interface Trade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  securityId: string;
  executionPrice: number;
  quantity: number;
  timestamp: Date;
  session: SessionState;
}

export interface OrderBook {
  securityId: string;
  bids: Order[];
  asks: Order[];
}

export interface ValidationResult {
  valid: boolean;
  rejectionReason: string | null;
}

export interface SessionInfo {
  session: SessionState;
  timeToNextSession: number;
  isMarketOpen: boolean;
  haltState: HaltType;
}

// CSD Types
export interface CSDAccount {
  accountNumber: string;
  clientName: string;
  clientId: string;
  brokerId: string;
  nationalId: string;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'FROZEN' | 'CLOSED';
  accountType: 'INDIVIDUAL' | 'INSTITUTIONAL' | 'BROKER_OWN';
  createdDate: Date;
}

export interface CSDHolding {
  accountNumber: string;
  securityId: string;
  securityName: string;
  isinCode: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  averageCostPrice: number;
  currentMarketValue: number;
  depositDate: Date;
  isCSDDeposited: boolean;
}

export interface CSDClearance {
  clearanceId: string;
  orderId: string;
  accountNumber: string;
  securityId: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  requestedAt: Date;
  clearedAt: Date | null;
  status: 'PENDING' | 'CLEARED' | 'REJECTED' | 'EXPIRED';
  rejectionReason: string | null;
  swiftMessageId: string;
  expiryTime: Date;
}

export interface CSDSettlement {
  settlementId: string;
  tradeId: string;
  buyerAccount: string;
  sellerAccount: string;
  securityId: string;
  isinCode: string;
  quantity: number;
  executionPrice: number;
  settlementAmount: number;
  settlementDate: Date;
  status: 'PENDING' | 'SETTLED' | 'FAILED' | 'CANCELLED';
  swiftMessageId: string;
  createdAt: Date;
  settledAt: Date | null;
}

export type SWIFTMessageType =
  | 'MT540' | 'MT541' | 'MT542' | 'MT543'
  | 'MT544' | 'MT545' | 'MT546' | 'MT547'
  | 'MT548' | 'MT509' | 'MT537' | 'MT535';

export interface SWIFTPayload {
  tradeReference?: string;
  isinCode?: string;
  quantity?: number;
  price?: number;
  settlementDate?: string;
  buyerAccount?: string;
  sellerAccount?: string;
  brokerCode?: string;
  securityDescription?: string;
  currency?: string;
  settlementAmount?: number;
  tradeDate?: string;
  status?: string;
  rejectionCode?: string;
  rejectionReason?: string;
}

export interface SWIFTMessage {
  messageId: string;
  messageType: SWIFTMessageType;
  sender: string;
  receiver: string;
  timestamp: Date;
  status: 'QUEUED' | 'SENT' | 'ACKNOWLEDGED' | 'REJECTED' | 'FAILED';
  payload: SWIFTPayload;
  acknowledgementTime: Date | null;
  rawMessage: string;
}

export interface CSDCommunicationLog {
  id: string;
  timestamp: Date;
  direction: 'OUTBOUND' | 'INBOUND';
  messageType: SWIFTMessageType;
  messageId: string;
  accountNumber: string;
  securityId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  summary: string;
}

export interface OrderSubmissionResult {
  success: boolean;
  error?: string;
  stage?: 'CSD_ACCOUNT' | 'CSD_HOLDINGS' | 'CSD_CLEARANCE' | 'ATS_VALIDATION' | 'ATS_SUBMISSION';
  order?: Order;
  clearance?: CSDClearance;
  swiftMessageId?: string;
}
