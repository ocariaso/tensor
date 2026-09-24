// Scene-scale stand-ins for our universe's constants, chosen so every effect is invisible at the default.
export const LIGHT_SPEED_OURS = 600; // world units per second, far above the subject's ~1 unit/s
export const UNCERTAINTY_OURS = 1e-4; // world units of positional blur
export const GRAVITY_OURS = 1e-4; // pull strength toward the central mass

export const LIGHT_SPEED_RANGE = { min: -3.5, max: 0 };
export const UNCERTAINTY_RANGE = { min: 0, max: 3.5 };
export const GRAVITY_RANGE = { min: 0, max: 4 };

/** Each dial is a power of ten away from our universe, where 0 means our own value. */
export interface ConstantDials {
  lightSpeedExp: number;
  uncertaintyExp: number;
  gravityExp: number;
}

export interface EffectiveConstants {
  lightSpeed: number;
  uncertainty: number;
  gravity: number;
}

export interface LawWorld {
  label: string;
  tint: string;
  dials: ConstantDials;
  /** Position in the 9D row, where ours sits at 0. */
  slot: number;
}

// Each world starts exactly like ours, so only its laws of physics differ.
export const LAW_WORLDS: LawWorld[] = [
  { label: 'Slow light · c ÷500', tint: '#ff9d5c', dials: { lightSpeedExp: -2.7, uncertaintyExp: 0, gravityExp: 0 }, slot: -1 },
  { label: 'Big quantum · h ×1000', tint: '#8affc4', dials: { lightSpeedExp: 0, uncertaintyExp: 3, gravityExp: 0 }, slot: 1 },
  { label: 'Strong gravity · G ×3000', tint: '#ffd27a', dials: { lightSpeedExp: 0, uncertaintyExp: 0, gravityExp: 3.5 }, slot: 2 },
];

/**
 * How many seconds the subject's own clock ticks per second of its universe's time.
 * Motion uses the real time-dilation factor; the gravity factor is an illustrative stand-in for general relativity.
 */
export function clockRate(speed: number, lightSpeed: number, gravity: number, distanceFromMass: number): number {
  const beta = Math.min(speed / lightSpeed, 0.99);
  const motion = Math.sqrt(1 - beta * beta);
  const well = 1 / (1 + (3 * gravity) / (distanceFromMass + 0.25));
  return motion * well;
}

/** Mirrors gravitate in physics.glsl so labels and ticks sit where the pinched tube is drawn. */
export function pinchTowardMass<T extends { x: number; z: number }>(point: T, gravity: number): T {
  const d = Math.hypot(point.x, point.z);
  if (d < 1e-4) return point;
  const pull = Math.min(gravity / (d + 0.25), d * 0.45);
  point.x -= (point.x / d) * pull;
  point.z -= (point.z / d) * pull;
  return point;
}

/** Blends from our universe (weight 0) to the dialed universe (weight 1) in log space. */
export function effectiveConstants(dials: ConstantDials, weight: number): EffectiveConstants {
  return {
    lightSpeed: LIGHT_SPEED_OURS * 10 ** (dials.lightSpeedExp * weight),
    uncertainty: UNCERTAINTY_OURS * 10 ** (dials.uncertaintyExp * weight),
    gravity: GRAVITY_OURS * 10 ** (dials.gravityExp * weight),
  };
}
