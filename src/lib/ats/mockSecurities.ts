// SIMULATION / DISPLAY ONLY — this module never determines what a user believes filled.
// Real fills come only from the exchange via fix-bridge-webhook.

import { Security, CSDAccount, CSDHolding } from './types';

export const ATS_SECURITIES: Security[] = [
  { id: 'AECI', ticker: 'AECI', name: 'AECI Mining Explosives Plc', board: 'EQUITY', lastClosingPrice: 129.67, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 7937, lastPrice: 129.67, isinCode: 'ZM0000000284', sector: 'Mining' },
  { id: 'AIRTEL', ticker: 'AIRTEL', name: 'Airtel Networks Plc', board: 'EQUITY', lastClosingPrice: 139.31, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 30476, lastPrice: 139.31, isinCode: 'ZM0000000342', sector: 'Telecommunications' },
  { id: 'BATA', ticker: 'BATA', name: 'Bata Zambia Plc', board: 'EQUITY', lastClosingPrice: 8.00, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 14, lastPrice: 8.00, isinCode: 'ZM0000000102', sector: 'Retail' },
  { id: 'BATZ', ticker: 'BATZ', name: 'British American Tobacco Zambia Plc', board: 'EQUITY', lastClosingPrice: 14.37, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 279325, lastPrice: 14.37, isinCode: 'ZM0000000029', sector: 'Manufacturing' },
  { id: 'CECA', ticker: 'CECA', name: 'CEC Africa Investments Limited', board: 'EQUITY', lastClosingPrice: 0.80, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 0, lastPrice: 0.80, isinCode: 'ZM0000000516', sector: 'Energy' },
  { id: 'CEC', ticker: 'CEC', name: 'Copperbelt Energy Corporation Plc', board: 'EQUITY', lastClosingPrice: 18.46, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 87569, lastPrice: 18.46, isinCode: 'ZM0000000136', sector: 'Energy' },
  { id: 'CHIL', ticker: 'CHIL', name: 'Chilanga Cement Plc', board: 'EQUITY', lastClosingPrice: 80.46, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 3575, lastPrice: 80.46, isinCode: 'ZM0000000011', sector: 'Manufacturing' },
  { id: 'MAFS', ticker: 'MAFS', name: 'Madison Financial Services Plc', board: 'EQUITY', lastClosingPrice: 1.81, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 25, lastPrice: 1.81, isinCode: 'ZM0000000391', sector: 'Financial Services' },
  { id: 'NATBREW', ticker: 'NATBREW', name: 'National Breweries Plc', board: 'EQUITY', lastClosingPrice: 2.87, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 226, lastPrice: 2.87, isinCode: 'ZM0000000086', sector: 'Manufacturing' },
  { id: 'PMDZ', ticker: 'PMDZ', name: 'Pamodzi Hotels Plc', board: 'EQUITY', lastClosingPrice: 4.62, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 0, lastPrice: 4.62, isinCode: 'ZM0000000177', sector: 'Hospitality' },
  { id: 'PUMA', ticker: 'PUMA', name: 'Puma Energy Plc', board: 'EQUITY', lastClosingPrice: 3.00, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 96343, lastPrice: 3.00, isinCode: 'ZM0000000185', sector: 'Energy' },
  { id: 'SCBL', ticker: 'SCBL', name: 'Standard Chartered Bank Zambia Plc', board: 'EQUITY', lastClosingPrice: 1.97, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 0, lastPrice: null, isinCode: 'ZM0000000094', sector: 'Banking' },
  { id: 'SHOPRITE', ticker: 'SHOPRITE', name: 'Shoprite Holdings Plc', board: 'EQUITY', lastClosingPrice: 350.00, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 8, lastPrice: 350.00, isinCode: 'ZAE000012084', sector: 'Retail' },
  { id: 'ZABR', ticker: 'ZABR', name: 'Zambia Breweries Plc', board: 'EQUITY', lastClosingPrice: 6.75, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 20176, lastPrice: 6.75, isinCode: 'ZM0000000078', sector: 'Manufacturing' },
  { id: 'ZCCM', ticker: 'ZCCM-IH', name: 'ZCCM Investments Holdings Plc', board: 'EQUITY', lastClosingPrice: 166.82, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 704, lastPrice: 166.82, isinCode: 'ZM0000000037', sector: 'Mining' },
  { id: 'ZFCO', ticker: 'ZFCO', name: 'Zambia Forestry and Forest Industries Corp', board: 'EQUITY', lastClosingPrice: 4.50, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 10, lastPrice: 4.50, isinCode: 'ZM0000000524', sector: 'Forestry' },
  { id: 'ZAMBEEF', ticker: 'ZMBF', name: 'Zambeef Products Plc', board: 'EQUITY', lastClosingPrice: 2.14, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 20083, lastPrice: 2.14, isinCode: 'ZM0000000201', sector: 'Agriculture' },
  { id: 'ZMFA', ticker: 'ZMFA', name: 'Metal Fabricators of Zambia Plc', board: 'EQUITY', lastClosingPrice: 59.95, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 643, lastPrice: 59.95, isinCode: 'ZM0000000243', sector: 'Manufacturing' },
  { id: 'ZMRE', ticker: 'ZMRE', name: 'Zambia Reinsurance Plc', board: 'EQUITY', lastClosingPrice: 2.73, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 0, lastPrice: null, isinCode: 'ZM0000000326', sector: 'Insurance' },
  { id: 'ZANACO', ticker: 'ZNCO', name: 'Zambia National Commercial Bank Plc', board: 'EQUITY', lastClosingPrice: 8.86, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 252632, lastPrice: 8.86, isinCode: 'ZM0000000250', sector: 'Banking' },
  { id: 'ZSUG', ticker: 'ZSUG', name: 'Zambia Sugar Plc', board: 'EQUITY', lastClosingPrice: 72.80, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 654, lastPrice: 72.80, isinCode: 'ZM0000000052', sector: 'Agriculture' },
  { id: 'REIZ', ticker: 'REIZ', name: 'Real Estate Investment Zambia Plc', board: 'EQUITY', lastClosingPrice: 0.09, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: false, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 0, lastPrice: 0.09, isinCode: 'ZM4000000013', sector: 'Real Estate' },
  { id: 'DCMS', ticker: 'DCMS', name: 'DotCom Zambia Plc', board: 'EQUITY', lastClosingPrice: 22.12, priceSpreadLimit: 0.25, tickSize: 0.01, tradingStatus: 'CLOSED', isNewlyListed: true, currentVWAP: null, dayHigh: null, dayLow: null, totalVolume: 468, lastPrice: 22.12, isinCode: 'ZM0000000581', sector: 'Technology' },
];

export const MOCK_CSD_ACCOUNTS: CSDAccount[] = [
  { accountNumber: 'CSD-001001', clientName: 'John Mwale', clientId: 'client-001', brokerId: 'broker-infinity-001', nationalId: '123456/10/1', accountStatus: 'ACTIVE', accountType: 'INDIVIDUAL', createdDate: new Date('2022-01-15') },
  { accountNumber: 'CSD-001002', clientName: 'Chileshe Investments Ltd', clientId: 'client-002', brokerId: 'broker-infinity-001', nationalId: 'COMP-2019-0042', accountStatus: 'ACTIVE', accountType: 'INSTITUTIONAL', createdDate: new Date('2021-06-10') },
  { accountNumber: 'CSD-001003', clientName: 'Mutale Banda', clientId: 'client-003', brokerId: 'broker-infinity-001', nationalId: '987654/11/1', accountStatus: 'ACTIVE', accountType: 'INDIVIDUAL', createdDate: new Date('2023-03-22') },
];

export const MOCK_CSD_HOLDINGS: CSDHolding[] = [
  { accountNumber: 'CSD-001001', securityId: 'ZANACO', securityName: 'Zambia National Commercial Bank Plc', isinCode: 'ZM0000000250', totalQuantity: 5000, availableQuantity: 5000, reservedQuantity: 0, averageCostPrice: 6.50, currentMarketValue: 40000, depositDate: new Date('2022-02-01'), isCSDDeposited: true },
  { accountNumber: 'CSD-001001', securityId: 'ZAMBEEF', securityName: 'Zambeef Products Plc', isinCode: 'ZM0000000201', totalQuantity: 2000, availableQuantity: 2000, reservedQuantity: 0, averageCostPrice: 1.80, currentMarketValue: 4280, depositDate: new Date('2022-03-10'), isCSDDeposited: true },
  { accountNumber: 'CSD-001002', securityId: 'ZCCM', securityName: 'ZCCM Investments Holdings Plc', isinCode: 'ZM0000000037', totalQuantity: 20000, availableQuantity: 18000, reservedQuantity: 2000, averageCostPrice: 120.00, currentMarketValue: 3336400, depositDate: new Date('2021-07-15'), isCSDDeposited: true },
  { accountNumber: 'CSD-001002', securityId: 'CEC', securityName: 'Copperbelt Energy Corporation Plc', isinCode: 'ZM0000000136', totalQuantity: 10000, availableQuantity: 10000, reservedQuantity: 0, averageCostPrice: 12.50, currentMarketValue: 184700, depositDate: new Date('2021-08-20'), isCSDDeposited: true },
  { accountNumber: 'CSD-001003', securityId: 'NATBREW', securityName: 'National Breweries Plc', isinCode: 'ZM0000000086', totalQuantity: 300, availableQuantity: 300, reservedQuantity: 0, averageCostPrice: 2.40, currentMarketValue: 861, depositDate: new Date('2023-04-05'), isCSDDeposited: true },
];

export const CSD_BIC = 'LUSEZMLUXXX';
export const BROKER_BIC = 'INFTYZMLUXXX';

// Best bid/ask data for each security
export const MARKET_DEPTH: Record<string, { bestBid: number | null; bestBidQty: number | null; bestAsk: number | null; bestAskQty: number | null }> = {
  AECI: { bestBid: 129.67, bestBidQty: 23146, bestAsk: 140.00, bestAskQty: 1050 },
  AIRTEL: { bestBid: 139.30, bestBidQty: 187, bestAsk: 139.31, bestAskQty: 85095 },
  BATA: { bestBid: 8.00, bestBidQty: 1382, bestAsk: null, bestAskQty: null },
  BATZ: { bestBid: 14.35, bestBidQty: 166, bestAsk: 14.37, bestAskQty: 21087 },
  CECA: { bestBid: 0.80, bestBidQty: 70666, bestAsk: 0.80, bestAskQty: 6364 },
  CEC: { bestBid: 18.30, bestBidQty: 12, bestAsk: 18.46, bestAskQty: 5969 },
  CHIL: { bestBid: 80.99, bestBidQty: 55, bestAsk: 81.00, bestAskQty: 16209 },
  MAFS: { bestBid: 1.81, bestBidQty: 7361, bestAsk: null, bestAskQty: null },
  NATBREW: { bestBid: 2.60, bestBidQty: 24, bestAsk: 2.87, bestAskQty: 15120 },
  PMDZ: { bestBid: 4.62, bestBidQty: 0, bestAsk: 4.62, bestAskQty: 2297 },
  PUMA: { bestBid: 2.95, bestBidQty: 217, bestAsk: 3.00, bestAskQty: 49431 },
  SCBL: { bestBid: null, bestBidQty: null, bestAsk: null, bestAskQty: null },
  SHOPRITE: { bestBid: 360.00, bestBidQty: 16, bestAsk: null, bestAskQty: null },
  ZABR: { bestBid: 6.75, bestBidQty: 616, bestAsk: null, bestAskQty: null },
  ZCCM: { bestBid: 166.00, bestBidQty: 27, bestAsk: 166.82, bestAskQty: 9 },
  ZFCO: { bestBid: 4.60, bestBidQty: 1528, bestAsk: null, bestAskQty: null },
  ZAMBEEF: { bestBid: 2.13, bestBidQty: 952, bestAsk: 2.14, bestAskQty: 115463 },
  ZMFA: { bestBid: 55.00, bestBidQty: 8, bestAsk: 59.39, bestAskQty: 929 },
  ZMRE: { bestBid: 3.00, bestBidQty: 4, bestAsk: null, bestAskQty: null },
  ZANACO: { bestBid: 10.10, bestBidQty: 42, bestAsk: null, bestAskQty: null },
  ZSUG: { bestBid: 72.80, bestBidQty: 151, bestAsk: 75.00, bestAskQty: 60 },
  REIZ: { bestBid: null, bestBidQty: null, bestAsk: 0.09, bestAskQty: 78173 },
  DCMS: { bestBid: 21.87, bestBidQty: 7, bestAsk: 22.05, bestAskQty: 706 },
};
