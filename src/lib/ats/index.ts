// SIMULATION / DISPLAY ONLY — this module never determines what a user believes filled.
// Real fills come only from the exchange via fix-bridge-webhook.

export * from './types';
export * from './mockSecurities';
export * from './validation';
export * from './orderBookEngine';
export * from './openingAuction';
export * from './continuousMatching';
export * from './closingVWAP';
