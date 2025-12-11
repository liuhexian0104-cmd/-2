import { GAMMA_CORRECTION } from '../constants';

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface ColorStop {
  pos: number;
  color: RGB;
}

// Deep Blue -> Blue -> Cyan -> Green -> Yellow -> Orange -> Red -> Magenta -> White
const THERMAL_STOPS: ColorStop[] = [
  { pos: 0.0, color: { r: 0, g: 0, b: 20 } },       // Deepest Black/Blue
  { pos: 0.15, color: { r: 0, g: 0, b: 128 } },     // Dark Blue
  { pos: 0.3, color: { r: 0, g: 128, b: 255 } },    // Azure
  { pos: 0.45, color: { r: 0, g: 255, b: 200 } },   // Cyan/Teal
  { pos: 0.55, color: { r: 50, g: 255, b: 50 } },   // Lime Green
  { pos: 0.65, color: { r: 255, g: 255, b: 0 } },   // Yellow
  { pos: 0.75, color: { r: 255, g: 128, b: 0 } },   // Orange
  { pos: 0.85, color: { r: 255, g: 0, b: 0 } },     // Red
  { pos: 0.95, color: { r: 255, g: 0, b: 255 } },   // Magenta
  { pos: 1.0, color: { r: 255, g: 255, b: 255 } }   // White Hot
];

const interpolateColor = (c1: RGB, c2: RGB, t: number): RGB => {
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
  };
};

export const generateGradientLUT = (steps: number = 1024): Uint8ClampedArray => {
  const lut = new Uint8ClampedArray(steps * 4); // RGBA

  for (let i = 0; i < steps; i++) {
    // 1. Normalize position 0-1
    let t = i / (steps - 1);
    
    // 2. Apply Gamma Correction to push colors towards ends or center
    // For thermal, we usually want to expand the dynamic range of the mids
    t = Math.pow(t, 1 / GAMMA_CORRECTION);

    // 3. Find segments
    let lower = THERMAL_STOPS[0];
    let upper = THERMAL_STOPS[THERMAL_STOPS.length - 1];

    for (let j = 0; j < THERMAL_STOPS.length - 1; j++) {
      if (t >= THERMAL_STOPS[j].pos && t <= THERMAL_STOPS[j + 1].pos) {
        lower = THERMAL_STOPS[j];
        upper = THERMAL_STOPS[j + 1];
        break;
      }
    }

    // 4. Local interpolation within segment
    const range = upper.pos - lower.pos;
    const localT = range === 0 ? 0 : (t - lower.pos) / range;
    
    const color = interpolateColor(lower.color, upper.color, localT);

    // 5. Store
    const index = i * 4;
    lut[index] = color.r;
    lut[index + 1] = color.g;
    lut[index + 2] = color.b;
    lut[index + 3] = 255; // Alpha always full
  }

  return lut;
};