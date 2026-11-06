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

/** One-time tips, shown the first time a visitor meets a function or turns on 記憶功能. */
export type TipId = FunctionId | 'memory';
export const TIPS: Partial<Record<TipId, { text: string; coach: CoachTarget; doneOn: EngineEvent[] }>> = {
  stepless: { text: '快切開始慢慢變亮，亮度剛好時再快切停住', coach: 'quick', doneOn: ['ramp-stop'] },
  'tri-color-night': { text: '快切依序換：白光 → 柔光 → 黃光 → 夜燈', coach: 'quick', doneOn: ['step'] },
  'two-color-stepless': { text: '每次快切換一種光色慢慢變亮，剛好時再快切停住', coach: 'quick', doneOn: ['ramp-stop'] },
  'three-color-stepless': { text: '每次快切換一種光色慢慢變亮，剛好時再快切停住', coach: 'quick', doneOn: ['ramp-stop'] },
  memory: { text: '記憶開了：關燈等 3 秒再開（慢切），看看會回到哪裡', coach: 'slow', doneOn: ['slow-memory'] },
};

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
