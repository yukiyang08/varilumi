/**
 * Switch-dimming functions, as described in Varilumi's buying guide
 * (https://www.varilumi.com/function-selection-guide/).
 */

export type FunctionId = 'four-step' | 'stepless' | 'tri-color-night' | 'two-color-stepless' | 'three-color-stepless';

export interface Step {
  /** 0..1 brightness */
  level: number;
  /** colour temperature in kelvin; undefined = use the fixture's chosen colour */
  kelvin?: number;
  label: string;
}

export interface FunctionDef {
  id: FunctionId;
  /** official Varilumi name, shown small */
  name: string;
  /** short name shown big (官網的叫法，去掉「經典」) */
  plainName: string;
  /** the need a visitor would say in their own words */
  need: string;
  needDesc: string;
  family: '調光型' | '調色型';
  /**
   * steps: 快切跳下一段.  stepless: 快切漸亮、再快切停住 (one colour).
   * multi-stepless: like stepless, but each new ramp switches to the next colour (兩色/三色無段調光).
   */
  mode: 'steps' | 'stepless' | 'multi-stepless';
  steps: Step[];
  /** colours a multi-stepless function ramps through, in order */
  colors?: number[];
  /** the function always remembers (記憶兩色/三色無段調光), so there is no 沒記憶 option */
  memoryBuiltIn?: boolean;
  /** whether the customer picks one fixed colour temperature (調光型) */
  colorSelectable: boolean;
  summary: string;
  howTo: string[];
}

export const KELVIN = { white: 6000, soft: 4000, yellow: 3000 } as const;
export type ColorChoice = keyof typeof KELVIN;
export const COLOR_LABEL: Record<ColorChoice, string> = { white: '白光', soft: '柔光', yellow: '黃光' };

export function kelvinLabel(k: number): string {
  if (k >= 5500) return '白光';
  if (k >= 3600) return '柔光';
  return '黃光';
}

export const FUNCTIONS: Record<FunctionId, FunctionDef> = {
  'four-step': {
    id: 'four-step',
    name: '經典四段調光',
    plainName: '四段調光',
    need: '簡單調亮調暗',
    needDesc: '按一下開關就換一段：亮 → 半亮 → 微亮 → 小夜燈',
    family: '調光型',
    mode: 'steps',
    steps: [
      { level: 1, label: '100%' },
      { level: 0.5, label: '50%' },
      { level: 0.25, label: '25%' },
      { level: 0.01, label: '1% 夜燈' },
    ],
    colorSelectable: true,
    summary: '一盞燈四種亮度，色溫固定。最經典、最直覺。',
    howTo: ['開燈：100% 全亮', '連按兩下開關（快切）：跳到下一段', '100% → 50% → 25% → 1% 夜燈 → 循環', '關燈超過 3 秒再開（慢切）：回到 100%'],
  },
  stepless: {
    id: 'stepless',
    name: '經典無段調光',
    plainName: '無段調光',
    need: '亮度想微調到剛好',
    needDesc: '燈會慢慢變亮，喜歡哪個亮度就停在哪裡',
    family: '調光型',
    mode: 'stepless',
    steps: [{ level: 1, label: '100%' }],
    colorSelectable: true,
    summary: '1～100% 任意亮度。無段是「無限多段」，不是沒有段數。',
    howTo: ['開燈：100% 全亮', '連按兩下（快切）：從 1% 夜燈開始，約 6 秒亮到 100%（先慢後快）', '亮度剛好時再連按兩下：停在這個亮度', '關燈超過 3 秒再開（慢切）：回到 100%'],
  },
  'tri-color-night': {
    id: 'tri-color-night',
    name: '三色一夜光',
    plainName: '三色一夜光',
    need: '白光、黃光都想要',
    needDesc: '白光讀書做事、黃光放鬆，最後一段是小夜燈',
    family: '調色型',
    mode: 'steps',
    steps: [
      { level: 1, kelvin: KELVIN.white, label: '白光 100%' },
      { level: 1, kelvin: KELVIN.soft, label: '柔光 100%' },
      { level: 1, kelvin: KELVIN.yellow, label: '黃光 100%' },
      { level: 0.01, kelvin: KELVIN.yellow, label: '黃光夜燈' },
    ],
    colorSelectable: false,
    summary: '白、柔、黃三種色溫全亮，第四段是黃光小夜燈。',
    howTo: ['開燈：白光全亮', '連按兩下（快切）：白 → 柔 → 黃 → 黃光夜燈 → 循環', '關燈超過 3 秒再開（慢切）：回到白光'],
  },
  'two-color-stepless': {
    id: 'two-color-stepless',
    name: '兩色無段調光',
    plainName: '兩色無段調光',
    need: '兩種光色都想微調亮度',
    needDesc: '白光、黃光各自從夜燈慢慢變亮，停在剛好的亮度，還會記住',
    family: '調色型',
    mode: 'multi-stepless',
    colors: [KELVIN.white, KELVIN.yellow],
    steps: [{ level: 1, kelvin: KELVIN.white, label: '白光 100%' }],
    colorSelectable: false,
    memoryBuiltIn: true,
    summary: '兩種色溫自由選，每一色都能無段調光，並且內建記憶。',
    howTo: [
      '慢切開燈：回到上次關燈前的光色和亮度',
      '連按兩下（快切）：第一色從夜燈開始約 6 秒慢慢變亮，亮度剛好時再快切停住並記住',
      '再快切一下：換第二色從夜燈慢慢變亮，再快切停住並記住',
      '兩種光色可以自由選（例如白光＋黃光）',
    ],
  },
  'three-color-stepless': {
    id: 'three-color-stepless',
    name: '三色無段調光',
    plainName: '三色無段調光',
    need: '三種光色、亮度都想自己調',
    needDesc: '白、柔、黃三種光色輪流從夜燈慢慢變亮，停在剛好的亮度，還會記住',
    family: '調色型',
    mode: 'multi-stepless',
    colors: [KELVIN.white, KELVIN.soft, KELVIN.yellow],
    steps: [{ level: 1, kelvin: KELVIN.white, label: '白光 100%' }],
    colorSelectable: false,
    memoryBuiltIn: true,
    summary: '白、柔、黃三種色溫都能無段調光，並且內建記憶。調法跟兩色無段一樣，多一色。',
    howTo: [
      '慢切開燈：回到上次關燈前的光色和亮度',
      '連按兩下（快切）：白光從夜燈開始約 6 秒慢慢變亮，亮度剛好時再快切停住並記住',
      '再快切：換柔光、再換黃光，同樣慢慢變亮、快切停住',
      '白 → 柔 → 黃 → 循環',
    ],
  },
};

/** Two-colour pairs a visitor can pick for 兩色無段調光 (官網：兩色溫自由選擇). */
export const COLOR_PAIRS: { label: string; colors: number[] }[] = [
  { label: '白光＋黃光', colors: [KELVIN.white, KELVIN.yellow] },
  { label: '白光＋柔光', colors: [KELVIN.white, KELVIN.soft] },
  { label: '柔光＋黃光', colors: [KELVIN.soft, KELVIN.yellow] },
];

export const FUNCTION_ORDER: FunctionId[] = ['four-step', 'stepless', 'tri-color-night', 'two-color-stepless', 'three-color-stepless'];

/** Timing rules (ms). The guide says quick < 2s and slow > 3s; 2–3s counts as slow here. */
export const QUICK_MS = 2000;
export const RAMP_MS = 6000;
export const MIN_LEVEL = 0.01;
/** 無段調光 ramp, measured on the real driver (piecewise linear):
 *  0–0.8 s hold 1% → 0.8–2.22 s rise to 12% (slope k) → 2.22–6 s rise to 100% (slope 3k). */
export const RAMP_HOLD_MS = 800;
export const RAMP_KNEE_MS = 2220;
export const RAMP_KNEE_LEVEL = 0.12;
/** How long the 慢切 button keeps the switch off (the copy says 關超過3秒才開). */
export const SLOW_GAP_MS = 3300;
export const FLASH_MS = 260;
