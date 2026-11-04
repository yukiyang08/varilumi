import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_SETUPS, FIXTURES, ROOMS, getSetup, powerText } from './scenes';
import { FUNCTION_ORDER, FUNCTIONS } from './engine/functions';

const PUBLIC = join(__dirname, '..', 'public');

describe('room × fixture setups', () => {
  it('covers every room with every fixture', () => {
    expect(ALL_SETUPS).toHaveLength(ROOMS.length * FIXTURES.length);
  });

  it.each(ALL_SETUPS.map((s) => [s.key, s]))('%s has its light layers and a thumbnail', (_k, s) => {
    const dir = join(PUBLIC, 'renders', s.dir);
    const meta = JSON.parse(readFileSync(join(dir, 'layers.json'), 'utf8'));
    for (const name of ['base', ...s.layers]) {
      expect(existsSync(join(dir, `${name}.webp`)), `${s.dir}/${name}.webp`).toBe(true);
      expect(meta.layers[name]?.meanLum, `${s.dir} meanLum ${name}`).toBeGreaterThan(0);
    }
    expect(existsSync(join(PUBLIC, 'thumbs', `${s.dir}.webp`))).toBe(true);
  });

  it('every fixture has products for every function', () => {
    const products = JSON.parse(readFileSync(join(PUBLIC, 'data', 'products.json'), 'utf8'));
    for (const f of FIXTURES) {
      for (const fn of FUNCTION_ORDER) {
        const n = products[f.id].filter((p: { functions: string[] }) => p.functions.includes(fn)).length;
        expect(n, `${f.name} × ${FUNCTIONS[fn].name}`).toBeGreaterThan(0);
      }
    }
  });

  it('reports power in proportion to brightness', () => {
    const s = getSetup('living', 'recessed'); // 6 × 12W
    expect(powerText(s, 1)).toBe('72W');
    expect(powerText(s, 0.25)).toBe('18W');
    expect(powerText(s, 0.01)).toBe('0.72W');
  });
});
