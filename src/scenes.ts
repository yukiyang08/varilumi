import { KELVIN, type FunctionId } from './engine/functions';

export type FixtureId = 'recessed' | 'track' | 'ceiling';

export interface LightGroupDef {
  id: FixtureId;
  name: string;
  detail: string;
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
        detail: '6 盞 9cm 散光崁燈',
        defaults: { functionId: 'four-step', kelvin: KELVIN.soft, memory: false },
      },
      {
        id: 'track',
        name: '軌道燈',
        detail: '2 盞 COB 投射軌道燈・照牆上的畫',
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
        detail: '1 盞 50cm 圓形吸頂燈',
        defaults: { functionId: 'tri-color-night', kelvin: KELVIN.soft, memory: false },
      },
    ],
  },
];

export const layerNames = (s: SceneDef) => s.groups.flatMap((g) => [`${g.id}_6000`, `${g.id}_3000`]);
