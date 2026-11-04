import { KELVIN, type FunctionId } from './engine/functions';

export type FixtureId = 'recessed' | 'track' | 'ceiling';

export interface LightGroupDef {
  id: FixtureId;
  name: string;
  detail: string;
  /** number of fixtures and rated watts each, for the live power reading */
  count: number;
  watts: number;
  /** extra fixtures are only controllable under 更多設定, so first-time visitors see one switch */
  advanced?: boolean;
  defaults: { functionId: FunctionId; kelvin: number; memory: boolean };
}

export interface SceneDef {
  id: 'living' | 'bedroom';
  name: string;
  groups: LightGroupDef[];
}

export const SCENES: SceneDef[] = [
  {
    id: 'living',
    name: '客廳',
    groups: [
      {
        id: 'recessed',
        name: '崁燈',
        detail: '6 盞 9cm/12W 散光崁燈',
        count: 6,
        watts: 12,
        defaults: { functionId: 'four-step', kelvin: KELVIN.soft, memory: false },
      },
      {
        id: 'track',
        name: '軌道燈',
        detail: '2 盞 15W 投射軌道燈・照牆上的畫',
        count: 2,
        watts: 15,
        advanced: true,
        defaults: { functionId: 'stepless', kelvin: KELVIN.yellow, memory: false },
      },
    ],
  },
  {
    id: 'bedroom',
    name: '臥室',
    groups: [
      {
        id: 'ceiling',
        name: '吸頂燈',
        detail: '1 盞 45W 吸頂燈（適合 4–5 坪）',
        count: 1,
        watts: 45,
        defaults: { functionId: 'tri-color-night', kelvin: KELVIN.soft, memory: false },
      },
    ],
  },
];

export const layerNames = (s: SceneDef) => s.groups.flatMap((g) => [`${g.id}_6000`, `${g.id}_3000`]);

/** LED power falls in proportion to brightness (飛利明: 亮度越低耗電等比例降低; 1% ≈ 0.15W on a 15W lamp). */
export function powerText(g: LightGroupDef, level: number): string {
  const w = g.count * g.watts * level;
  const n = w >= 10 ? w.toFixed(0) : w >= 1 ? w.toFixed(1) : w.toFixed(2);
  return `${n}W`;
}
