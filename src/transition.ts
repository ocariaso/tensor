/** Full strength while the level is within [low, high], fading out over half a level beyond either end. */
export function levelBand(level: number, low: number, high: number): number {
  const outside = Math.max(low - level, level - high, 0);
  return Math.min(1, Math.max(0, 1 - outside * 2));
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Eased tween of one value that restarts smoothly when retargeted mid-flight. */
export class Transition {
  private from: number;
  private to: number;
  private elapsed = 0;
  value: number;

  constructor(
    initial: number,
    public duration: number,
  ) {
    this.from = initial;
    this.to = initial;
    this.value = initial;
  }

  get done(): boolean {
    return this.value === this.to;
  }

  retarget(to: number): void {
    if (to === this.to) return;
    this.from = this.value;
    this.to = to;
    this.elapsed = 0;
  }

  update(dt: number): number {
    if (this.done) return this.value;
    this.elapsed += dt;
    const t = this.duration <= 0 ? 1 : Math.min(this.elapsed / this.duration, 1);
    this.value = t >= 1 ? this.to : this.from + (this.to - this.from) * easeInOutCubic(t);
    return this.value;
  }
}
