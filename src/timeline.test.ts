import { describe, expect, it } from 'vitest';
import { clampPlayhead, describeMoment, momentBadge, percent } from './timeline';

describe('clampPlayhead', () => {
  it('keeps the playhead within the drawn past and future', () => {
    expect(clampPlayhead(-4, 2.5, 1.5)).toBe(-2.5);
    expect(clampPlayhead(3, 2.5, 1.5)).toBe(1.5);
    expect(clampPlayhead(-1, 2.5, 1.5)).toBe(-1);
  });
});

describe('describeMoment', () => {
  it('names the present plainly', () => {
    expect(describeMoment(0)).toBe('now');
  });

  it('marks the past and flags the future as an estimate', () => {
    expect(describeMoment(-1.2)).toBe('−1.20 s · past');
    expect(describeMoment(0.8)).toBe('+0.80 s · future (estimate)');
  });
});

describe('momentBadge', () => {
  it('reads LIVE at the present, REPLAY behind it and ESTIMATE ahead of it', () => {
    expect(momentBadge(0)).toBe('LIVE');
    expect(momentBadge(-0.5)).toBe('REPLAY −0.50 s');
    expect(momentBadge(1)).toBe('ESTIMATE +1.00 s');
  });

  it('can name the future as a prediction', () => {
    expect(momentBadge(0.5, 'predicted')).toBe('PREDICTED +0.50 s');
    expect(describeMoment(0.5, 'predicted')).toBe('+0.50 s · future (predicted)');
  });
});

describe('percent', () => {
  it('rounds a chance to a whole percentage within 0 to 100', () => {
    expect(percent(0.678)).toBe('68%');
    expect(percent(1.2)).toBe('100%');
    expect(percent(-0.1)).toBe('0%');
  });
});
