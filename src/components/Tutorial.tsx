interface Props {
  step: number; // 0..3 (3 = done)
  onSkip: () => void;
  onClose: () => void;
}

const STEPS = [
  { title: '① 開燈', text: '按一下下面的牆壁開關，把燈打開。' },
  { title: '② 快切', text: '關燈後 2 秒內馬上再打開（或按「⚡快切」），看燈怎麼變。' },
  { title: '③ 慢切', text: '關燈超過 2 秒再打開（或按「🐢慢切」），燈會回到預設狀態。' },
];

/** Interactive 3-step guide; each step completes when the visitor actually does it. */
export function Tutorial({ step, onSkip, onClose }: Props) {
  if (step >= 3) {
    return (
      <div className="tutorial done" role="status">
        <div>
          <b>學會了！🎉</b>
          <p>這就是開關調光：不用換開關，只靠「快切、慢切」的節奏調光調色。換其他功能試試看吧。</p>
        </div>
        <button type="button" className="link" onClick={onClose}>
          關閉
        </button>
      </div>
    );
  }
  const s = STEPS[step];
  return (
    <div className="tutorial" role="status" aria-live="polite">
      <div className="tut-dots" aria-hidden="true">
        {STEPS.map((_, i) => (
          <span key={i} className={i < step ? 'ok' : i === step ? 'cur' : ''} />
        ))}
      </div>
      <div>
        <b>{s.title}</b>
        <p>{s.text}</p>
      </div>
      <button type="button" className="link" onClick={onSkip}>
        略過教學
      </button>
    </div>
  );
}
