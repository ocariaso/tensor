export const PLAYBACK_RATES = [0.25, 0.5, 1, 2, 4] as const;

/** Keeps the playhead inside the stretch of time the structure feed draws. */
export function clampPlayhead(offset: number, past: number, future: number): number {
  return Math.min(future, Math.max(-past, offset));
}

/** Describes where the playhead sits relative to the present, marking the future as an estimate. */
export function describeMoment(offset: number): string {
  if (Math.abs(offset) < 0.005) return 'now';
  const seconds = `${Math.abs(offset).toFixed(2)} s`;
  return offset < 0 ? `−${seconds} · past` : `+${seconds} · future (estimate)`;
}

/** A short status for the moment feed's badge. */
export function momentBadge(offset: number): string {
  if (Math.abs(offset) < 0.005) return 'LIVE';
  return offset < 0 ? `REPLAY −${Math.abs(offset).toFixed(2)} s` : `ESTIMATE +${offset.toFixed(2)} s`;
}
