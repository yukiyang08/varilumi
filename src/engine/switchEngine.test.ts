import { describe, expect, it } from 'vitest';
import { SwitchEngine, rampLevel } from './switchEngine';
import { KELVIN, RAMP_MS, type FunctionId } from './functions';

const make = (functionId: FunctionId, memory = false, kelvin = KELVIN.soft) =>
  new SwitchEngine({ functionId, memory, kelvin });

/** Drive an engine with a simple virtual clock. */
function driver(e: SwitchEngine) {
  let t = 1_000;
  return {
    on: () => e.press((t += 10)),
    off: () => e.press((t += 10)),
    wait: (ms: number) => (t += ms),
    quick: () => { e.press((t += 10)); t += 400; return e.press(t); },
    slow: () => { e.press((t += 10)); t += 3500; return e.press(t); },
    get s() { return e.state(t); },
  };
}

describe('經典四段調光', () => {
  it('starts at 100% and steps 100 → 50 → 25 → 1 → 100 on quick toggles', () => {
    const d = driver(make('four-step'));
    expect(d.on()).toBe('first');
    expect(d.s.level).toBe(1);
    const seen = [d.s.level];
    for (let i = 0; i < 4; i++) {
      expect(d.quick()).toBe('quick');
      seen.push(d.s.level);
    }
    expect(seen).toEqual([1, 0.5, 0.25, 0.01, 1]);
  });

  it('slow toggle returns to 100% without memory', () => {
    const d = driver(make('four-step'));
    d.on(); d.quick(); d.quick(); // 25%
    expect(d.slow()).toBe('slow');
    expect(d.s.level).toBe(1);
  });

  it('slow toggle keeps the last step with memory', () => {
    const d = driver(make('four-step', true));
    d.on(); d.quick(); d.quick(); // 25%
    d.slow();
    expect(d.s.level).toBe(0.25);
    expect(d.s.stepIndex).toBe(2);
  });

  it('keeps the chosen colour temperature', () => {
    const d = driver(make('four-step', false, KELVIN.yellow));
    d.on(); d.quick();
    expect(d.s.kelvin).toBe(3000);
  });

  it('is dark while switched off and reports off time', () => {
    const d = driver(make('four-step'));
    d.on(); d.off(); d.wait(700);
    expect(d.s.level).toBe(0);
    expect(d.s.offFor).toBe(700);
  });

  it('treats exactly 2s off as slow', () => {
    const e = make('four-step');
    e.press(0); e.press(100); e.press(500); // first on, off, quick on → 50%
    expect(e.state(500).level).toBe(0.5);
    e.press(1000);
    expect(e.press(3000)).toBe('slow');
    expect(e.state(3000).level).toBe(1);
  });
});

describe('經典無段調光', () => {
  it('slow on = 100%', () => {
    const d = driver(make('stepless'));
    d.on();
    expect(d.s.level).toBe(1);
    expect(d.s.ramping).toBe(false);
  });

  it('quick toggle ramps from 1% to 100% over 6 s', () => {
    const d = driver(make('stepless'));
    d.on(); d.quick();
    expect(d.s.ramping).toBe(true);
    expect(d.s.level).toBeCloseTo(0.01, 3);
    d.wait(RAMP_MS / 2);
    expect(d.s.level).toBeCloseTo(0.1, 2); // exponential midpoint
    d.wait(RAMP_MS);
    expect(d.s.ramping).toBe(false);
    expect(d.s.level).toBe(1);
  });

  it('a second quick toggle stops the ramp at the reached level', () => {
    const d = driver(make('stepless'));
    d.on(); d.quick();
    d.wait(3000);
    d.quick();
    const expected = rampLevel(3000 + 10); // level when the switch went off
    expect(d.s.ramping).toBe(false);
    expect(d.s.level).toBeCloseTo(expected, 4);
    d.wait(10_000);
    expect(d.s.level).toBeCloseTo(expected, 4); // stays put
  });

  it('without memory a slow toggle goes back to 100%', () => {
    const d = driver(make('stepless'));
    d.on(); d.quick(); d.wait(2000); d.quick();
    d.slow();
    expect(d.s.level).toBe(1);
  });

  it('with memory a slow toggle restores the stopped level', () => {
    const d = driver(make('stepless', true));
    d.on(); d.quick(); d.wait(2000); d.quick();
    const kept = d.s.level;
    d.slow();
    expect(d.s.level).toBeCloseTo(kept, 6);
  });

  it('with memory an unstopped ramp flashes once and memorises 100%', () => {
    const e = make('stepless', true);
    e.press(0); e.press(100); e.press(300); // ramp starts at 300
    const done = 300 + RAMP_MS;
    expect(e.state(done + 50).flashing).toBe(true);
    expect(e.state(done + 50).level).toBe(0);
    expect(e.state(done + 1000).flashing).toBe(false);
    expect(e.state(done + 1000).level).toBe(1);
  });

  it('without memory an unstopped ramp does not flash', () => {
    const e = make('stepless');
    e.press(0); e.press(100); e.press(300);
    expect(e.state(300 + RAMP_MS + 50).flashing).toBe(false);
  });
});

describe('三色一夜光', () => {
  it('cycles white → soft → yellow → yellow night light', () => {
    const d = driver(make('tri-color-night'));
    d.on();
    const seen = [[d.s.kelvin, d.s.level]];
    for (let i = 0; i < 4; i++) { d.quick(); seen.push([d.s.kelvin, d.s.level]); }
    expect(seen).toEqual([[6000, 1], [4000, 1], [3000, 1], [3000, 0.01], [6000, 1]]);
  });

  it('memory keeps the colour after a slow toggle', () => {
    const d = driver(make('tri-color-night', true));
    d.on(); d.quick(); d.quick(); // yellow
    d.slow();
    expect(d.s.kelvin).toBe(3000);
    expect(d.s.level).toBe(1);
  });
});

describe('configure', () => {
  it('switching function resets to off and the next press is a fresh start', () => {
    const e = make('four-step');
    e.press(0); e.press(100); e.press(200); // 50%
    e.configure({ functionId: 'tri-color-night' }, 300);
    expect(e.state(300).switchOn).toBe(false);
    expect(e.press(400)).toBe('first');
    expect(e.state(400).kelvin).toBe(6000);
  });

  it('changing colour does not reset the step', () => {
    const e = make('four-step');
    e.press(0); e.press(100); e.press(200);
    e.configure({ kelvin: 6000 }, 300);
    expect(e.state(300).level).toBe(0.5);
    expect(e.state(300).kelvin).toBe(6000);
  });
});
