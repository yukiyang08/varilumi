import { useEffect, useRef } from 'react';

/** First visit on this device: a welcome popup offering the 20-second 快切 / 慢切 lesson. Esc counts as skip. */
export function TutorialAsk({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
    yes.current?.focus(); // showModal focuses the first button (skip); Enter should start the lesson
  }, []);
  return (
    <dialog
      ref={ref}
      className="tut-ask"
      aria-labelledby="tut-ask-title"
      onCancel={(e) => {
        e.preventDefault();
        onNo();
      }}
    >
      <h2 id="tut-ask-title">歡迎來到飛利明 開關調光體驗館</h2>
      <p>花 20 秒學會「快切」和「慢切」，就知道怎麼用開關調光。</p>
      <div className="tut-ask-actions">
        <button type="button" className="tut-ask-no" onClick={onNo}>
          跳過教學
        </button>
        <button type="button" className="tut-ask-yes" onClick={onYes} ref={yes}>
          開始教學
        </button>
      </div>
    </dialog>
  );
}
