import { KELVIN } from './engine/functions';

export type RoomId = 'living' | 'bedroom' | 'dining' | 'study';
export type FixtureId = 'recessed' | 'track' | 'ceiling' | 'cove';

export interface RoomDef {
  id: RoomId;
  name: string;
  blurb: string;
}

export interface FixtureDef {
  id: FixtureId;
  name: string;
  blurb: string;
  /** default fixed colour for 調光型 functions */
  kelvin: number;
}

export const ROOMS: RoomDef[] = [
  { id: 'living', name: '客廳', blurb: '看電視、聊天、招待客人' },
  { id: 'bedroom', name: '臥室', blurb: '睡前放鬆、半夜起床' },
  { id: 'dining', name: '餐廳', blurb: '吃飯、全家聚在一起' },
  { id: 'study', name: '書房', blurb: '讀書、工作、需要專心' },
];

export const FIXTURES: FixtureDef[] = [
  { id: 'recessed', name: '崁燈', blurb: '嵌在天花板裡，最常見，整間均勻照亮', kelvin: KELVIN.soft },
  { id: 'track', name: '軌道燈', blurb: '可以轉方向，照畫、照桌面、照重點', kelvin: KELVIN.yellow },
  { id: 'ceiling', name: '吸頂燈', blurb: '一盞大燈裝在天花板中間，簡單好裝', kelvin: KELVIN.soft },
  { id: 'cove', name: '間照', blurb: '藏在天花板邊緣，光往上打，柔和不刺眼', kelvin: KELVIN.yellow },
];

/** Inner cove perimeter (m) per room: 2 × ((W − 0.9) + (D − 0.9)), see blender/fixtures.py. */
const COVE_M: Record<RoomId, number> = { living: 16, bedroom: 14, dining: 14, study: 12 };

/** How many fixtures of which rating each room uses (for the live power reading). */
const PLAN: Record<RoomId, Record<FixtureId, { count: number; watts: number; detail: string }>> = {
  living: {
    recessed: { count: 6, watts: 12, detail: '6 盞 9cm/12W 散光崁燈' },
    track: { count: 5, watts: 15, detail: '2 條軌道、5 盞 15W 軌道燈' },
    ceiling: { count: 1, watts: 70, detail: '1 盞 70W 吸頂燈（適合 5–7 坪）' },
    cove: { count: COVE_M.living, watts: 8, detail: `四周間照，約 ${COVE_M.living} 米燈帶` },
  },
  bedroom: {
    recessed: { count: 4, watts: 12, detail: '4 盞 9cm/12W 散光崁燈' },
    track: { count: 3, watts: 15, detail: '1 條軌道、3 盞 15W 軌道燈' },
    ceiling: { count: 1, watts: 45, detail: '1 盞 45W 吸頂燈（適合 4–5 坪）' },
    cove: { count: COVE_M.bedroom, watts: 8, detail: `四周間照，約 ${COVE_M.bedroom} 米燈帶` },
  },
  dining: {
    recessed: { count: 4, watts: 12, detail: '4 盞 9cm/12W 散光崁燈' },
    track: { count: 3, watts: 15, detail: '餐桌上方 1 條軌道、3 盞 15W' },
    ceiling: { count: 1, watts: 45, detail: '1 盞 45W 吸頂燈（適合 4–5 坪）' },
    cove: { count: COVE_M.dining, watts: 8, detail: `四周間照，約 ${COVE_M.dining} 米燈帶` },
  },
  study: {
    recessed: { count: 4, watts: 12, detail: '4 盞 9cm/12W 散光崁燈' },
    track: { count: 3, watts: 15, detail: '1 條軌道、3 盞照書櫃與桌面' },
    ceiling: { count: 1, watts: 45, detail: '1 盞 45W 吸頂燈（適合 4–5 坪）' },
    cove: { count: COVE_M.study, watts: 8, detail: `四周間照，約 ${COVE_M.study} 米燈帶` },
  },
};

/** One room with one kind of fixture: what the visitor is trying out. */
export interface Setup {
  key: string;
  room: RoomDef;
  fixture: FixtureDef;
  count: number;
  watts: number;
  detail: string;
  /** folder under public/renders */
  dir: string;
  /** light layers in that folder (besides base) */
  layers: string[];
}

export function getSetup(room: RoomId, fixture: FixtureId): Setup {
  const p = PLAN[room][fixture];
  return {
    key: `${room}-${fixture}`,
    room: ROOMS.find((r) => r.id === room)!,
    fixture: FIXTURES.find((f) => f.id === fixture)!,
    ...p,
    dir: `${room}-${fixture}`,
    layers: [`${fixture}_6000`, `${fixture}_3000`],
  };
}

export const ALL_SETUPS: Setup[] = ROOMS.flatMap((r) => FIXTURES.map((f) => getSetup(r.id, f.id)));

/** LED power falls in proportion to brightness (飛利明: 亮度越低耗電等比例降低; 1% ≈ 0.15W on a 15W lamp). */
export function powerText(s: Setup, level: number): string {
  const w = s.count * s.watts * level;
  const n = w >= 10 ? w.toFixed(0) : w >= 1 ? w.toFixed(1) : w.toFixed(2);
  return `${n}W`;
}
