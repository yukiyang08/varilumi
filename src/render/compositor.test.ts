import { describe, expect, it } from 'vitest';
import { adaptation } from './compositor';

/** picture brightness relative to 100% (window ambient = 1.2% of the fixture, as in the compositor) */
const picture = (level: number) => {
  const x = (0.012 + level) / 1.012;
  return x * adaptation(x);
};

describe('eye adaptation', () => {
  it('does nothing at full brightness', () => {
    expect(adaptation(1)).toBe(1);
  });

  it('keeps the 1% night light as bright as the old single-slope curve', () => {
    const x = 0.022 / 1.012;
    expect(picture(0.01)).toBeCloseTo(x * Math.pow(1 / x, 0.69), 2);
  });

  it('makes 50% clearly darker than 100% (was 1.24x on screen, now over 1.4x)', () => {
    expect(picture(1) / picture(0.5)).toBeGreaterThan(1.4);
  });

  it('never gets brighter as the lamp dims', () => {
    let prev = Infinity;
    for (let l = 1; l >= 0.01; l -= 0.01) {
      expect(picture(l)).toBeLessThanOrEqual(prev + 1e-9);
      prev = picture(l);
    }
  });
});
