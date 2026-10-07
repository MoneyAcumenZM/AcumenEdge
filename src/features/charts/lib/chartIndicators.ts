import { computeIndicator } from './chartDrawings';

export interface IndicatorConfig {
  type: 'MA' | 'EMA' | 'BB' | 'VWAP' | 'RSI' | 'Volume';
  period: number;
  enabled: boolean;
  color: string;
  label: string;
}

export const DEFAULT_INDICATORS: IndicatorConfig[] = [
  { type: 'MA', period: 20, enabled: false, color: '#f59e0b', label: 'MA (20)' },
  { type: 'EMA', period: 50, enabled: false, color: '#8b5cf6', label: 'EMA (50)' },
  { type: 'BB', period: 20, enabled: false, color: '#7c3aed', label: 'Bollinger Bands' },
  { type: 'VWAP', period: 1, enabled: false, color: '#f97316', label: 'VWAP' },
  { type: 'RSI', period: 14, enabled: false, color: '#8b5cf6', label: 'RSI (14)' },
  { type: 'Volume', period: 1, enabled: false, color: '#06b6d4', label: 'Volume' },
];

export function computeAllIndicators(
  data: { open: number; high: number; low: number; close: number; volume: number }[],
  indicators: IndicatorConfig[]
): Record<string, number[]> {
  const results: Record<string, number[]> = {};
  for (const ind of indicators) {
    if (!ind.enabled) continue;
    if (ind.type === 'MA' || ind.type === 'EMA' || ind.type === 'RSI') {
      results[ind.label] = computeIndicator(ind.type, data, ind.period);
    }
    if (ind.type === 'BB') {
      const ma = computeIndicator('MA', data, ind.period);
      const upper: number[] = [], lower: number[] = [];
      for (let i = 0; i < data.length; i++) {
        if (isNaN(ma[i])) { upper.push(NaN); lower.push(NaN); continue; }
        let variance = 0;
        for (let j = i - ind.period + 1; j <= i; j++) variance += (data[j].close - ma[i]) ** 2;
        const std = Math.sqrt(variance / ind.period);
        upper.push(ma[i] + 2 * std);
        lower.push(ma[i] - 2 * std);
      }
      results['BB_upper'] = upper;
      results['BB_middle'] = ma;
      results['BB_lower'] = lower;
    }
    if (ind.type === 'Volume') {
      results['Volume'] = data.map(d => d.volume);
    }
  }
  return results;
}
