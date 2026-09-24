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

/** Blends from our universe (weight 0) to the dialed universe (weight 1) in log space. */
export function effectiveConstants(dials: ConstantDials, weight: number): EffectiveConstants {
  return {
    lightSpeed: LIGHT_SPEED_OURS * 10 ** (dials.lightSpeedExp * weight),
    uncertainty: UNCERTAINTY_OURS * 10 ** (dials.uncertaintyExp * weight),
    gravity: GRAVITY_OURS * 10 ** (dials.gravityExp * weight),
  };
}
