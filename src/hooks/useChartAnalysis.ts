import { useState, useRef, useCallback, useEffect } from 'react';

export type DrawingTool = 'cursor' | 'crosshair' | 'trendline' | 'hline' | 'vline' | 'rect' | 'fib' | 'arrow' | 'text';

export interface Drawing {
  id: string;
  tool: DrawingTool;
  pts: { x: number; y: number }[];
  text?: string;
  color?: string;
  createdAt: string;
}

interface UseChartAnalysisReturn {
  drawings: Drawing[];
  addDrawing: (d: Omit<Drawing, 'id' | 'createdAt'>) => void;
  removeDrawing: (id: string) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  clearAll: () => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  activeTool: DrawingTool;
  setActiveTool: (t: DrawingTool) => void;
  saveDrawings: (symbol: string) => void;
  loadDrawings: (symbol: string) => void;
}

export function useChartAnalysis(): UseChartAnalysisReturn {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor');

  const addDrawing = useCallback((d: Omit<Drawing, 'id' | 'createdAt'>) => {
    const drawing: Drawing = {
      ...d,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setDrawings(prev => [...prev, drawing]);
  }, []);

  const removeDrawing = useCallback((id: string) => {
    setDrawings(prev => prev.filter(d => d.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const updateDrawing = useCallback((id: string, updates: Partial<Drawing>) => {
    setDrawings(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const clearAll = useCallback(() => {
    setDrawings([]);
    setSelectedId(null);
  }, []);

  const saveDrawings = useCallback((symbol: string) => {
    try {
      localStorage.setItem(`circle_analysis_${symbol}`, JSON.stringify(drawings));
    } catch {}
  }, [drawings]);

  const loadDrawings = useCallback((symbol: string) => {
    try {
      const stored = localStorage.getItem(`circle_analysis_${symbol}`);
      if (stored) setDrawings(JSON.parse(stored));
      else setDrawings([]);
    } catch { setDrawings([]); }
  }, []);

  return { drawings, addDrawing, removeDrawing, updateDrawing, clearAll, selectedId, setSelectedId, activeTool, setActiveTool, saveDrawings, loadDrawings };
}
