import type { FunctionId } from '../engine/functions';
import type { EngineEvent } from '../engine/switchEngine';

/** Which button the coach points at (it glows). */
export type CoachTarget = 'quick' | 'slow';

/** First visit: learn 快切, then 慢切. One line each; the glowing button shows what to press. */
export const TUT_STEPS: { title: string; coach: CoachTarget }[] = [
  { title: '快切＝關了馬上再開，燈會換下一段', coach: 'quick' },
  { title: '慢切＝關燈超過 3 秒再開，燈會回到預設', coach: 'slow' },
];
export const TUT_DONE = '學會了！接下來選一個功能試試看';

/** What 快切 does with each function, for the first lesson line. */
export const QUICK_LESSON: Record<FunctionId, string> = {
  'four-step': '快切＝關了馬上再開，燈會換下一段',
  'tri-color-night': '快切＝關了馬上再開，換下一種光色',
  stepless: '快切＝關了馬上再開，燈會從 1% 慢慢變亮',
  'two-color-stepless': '快切＝關了馬上再開，換一種光色從 1% 慢慢變亮',
  'three-color-stepless': '快切＝關了馬上再開，換一種光色從 1% 慢慢變亮',
};

/** One-time tips, shown the first time a visitor meets a function or turns on 記憶功能. */
export type TipId = FunctionId | 'memory';
export const TIPS: Partial<Record<TipId, { text: string; coach: CoachTarget; doneOn: EngineEvent[] }>> = {
  stepless: { text: '快切開始慢慢變亮，亮度剛好時再快切停住', coach: 'quick', doneOn: ['ramp-stop'] },
  'tri-color-night': { text: '快切依序換：白光 → 柔光 → 黃光 → 夜燈', coach: 'quick', doneOn: ['step'] },
  'two-color-stepless': { text: '每次快切換一種光色慢慢變亮，剛好時再快切停住', coach: 'quick', doneOn: ['ramp-stop'] },
  'three-color-stepless': { text: '每次快切換一種光色慢慢變亮，剛好時再快切停住', coach: 'quick', doneOn: ['ramp-stop'] },
  memory: { text: '記憶開了：關燈等 3 秒再開（慢切），看看會回到哪裡', coach: 'slow', doneOn: ['slow-memory'] },
};

/**
 * Animated demo per function: the hand presses the switch by itself. Numbers are pauses (ms) so the visitor
 * can see the result; each press is captioned with what just happened.
 */
export type DemoAction = 'quick' | 'slow' | 'mem-on' | number;
export const DEMOS: Record<FunctionId, DemoAction[]> = {
  'four-step': [1000, 'quick', 1300, 'quick', 1300, 'quick', 1300, 'slow', 1800],
  stepless: [1000, 'quick', 3200, 'quick', 1800, 'slow', 1800],
  'tri-color-night': [1000, 'quick', 1300, 'quick', 1300, 'quick', 1300, 'slow', 1800],
  'two-color-stepless': [1000, 'quick', 2600, 'quick', 1300, 'quick', 3000, 'quick', 1800],
  'three-color-stepless': [1000, 'quick', 2600, 'quick', 1100, 'quick', 2600, 'quick', 1100, 'quick', 3000, 'quick', 1800],
};

/** Gets the lamp away from its default, the way each function does it (so 慢切 has something to forget or keep). */
const ADJUST: Record<FunctionId, DemoAction[]> = {
  'four-step': ['quick'],
  'tri-color-night': ['quick'],
  stepless: ['quick', 2400, 'quick'],
  'two-color-stepless': ['quick', 2400, 'quick'],
  'three-color-stepless': ['quick', 2400, 'quick'],
};

/** 記憶功能 side by side: adjust → 慢切 without memory (back to default), then with memory (comes back). */
export function memoryDemo(fn: FunctionId): DemoAction[] {
  return [1200, ...ADJUST[fn], 1300, 'slow', 2200, 'mem-on', 1800, ...ADJUST[fn], 1300, 'slow', 2600];
}

interface Props {
  text: string;
  /** tutorial progress dots: [current step, total]; omitted for the done card and tips */
  dots?: [number, number];
  done?: boolean;
  closeLabel: string;
  onClose: () => void;
}

/** One-line coach card above the switch. */
export function CoachCard({ text, dots, done, closeLabel, onClose }: Props) {
  return (
    <div className={`tutorial ${done ? 'done' : ''} ${dots ? '' : 'no-dots'}`} role="status" aria-live="polite">
      {dots && (
        <div className="tut-dots" aria-hidden="true">
          {Array.from({ length: dots[1] }, (_, i) => (
            <span key={i} className={i < dots[0] ? 'ok' : i === dots[0] ? 'cur' : ''} />
          ))}
        </div>
      )}
      <b>{text}</b>
      <button type="button" className="link" onClick={onClose}>
        {closeLabel}
      </button>
    </div>
  );
}
