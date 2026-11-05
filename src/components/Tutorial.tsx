interface Props {
  step: number; // 0..2 (2 = done)
  onSkip: () => void;
  onClose: () => void;
}

export const TUT_STEPS = [
  { title: '按「快切」或連按兩下開關', text: '關了馬上再開＝快切，燈會換到下一段。' },
  { title: '按「慢切」或關燈超過 3 秒再開', text: '這叫慢切，燈會回到預設的狀態。' },
];
export const TUT_DONE = { title: '學會了！', text: '飛利明開關調光就是這麼簡單。換其他功能試試看吧。' };

/** Two-step guide; each step completes when the visitor actually does it with the switch. */
export function Tutorial({ step, onSkip, onClose }: Props) {
  const done = step >= TUT_STEPS.length;
  const s = done ? TUT_DONE : TUT_STEPS[step];
  return (
    <div className={`tutorial ${done ? 'done' : ''}`} role="status" aria-live="polite">
      {!done && (
        <div className="tut-dots" aria-hidden="true">
          {TUT_STEPS.map((_, i) => (
            <span key={i} className={i < step ? 'ok' : i === step ? 'cur' : ''} />
          ))}
        </div>
      )}
      <div>
        <b>{done ? '🎉 ' : `${step + 1}. `}{s.title}</b>
        <p>{s.text}</p>
      </div>
      <button type="button" className="link" onClick={done ? onClose : onSkip}>
        {done ? '關閉' : '略過'}
      </button>
    </div>
  );
}
