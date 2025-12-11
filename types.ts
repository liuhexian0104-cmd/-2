export interface Point {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface HeatStats {
  centroid: Point;
  totalHeat: number;
  pixelCount: number;
}

export enum VisualMode {
  THERMAL = 'THERMAL',
  SPECTRAL = 'SPECTRAL',
  MAGMA = 'MAGMA'
}

export interface GeminiAnalysisResult {
  title: string;
  energyLevel: string;
  description: string;
  elements: string[];
}