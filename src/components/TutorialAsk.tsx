import { useEffect, useRef } from 'react';

/** First visit on this device: ask whether to run the 20-second 快切 / 慢切 lesson. Esc counts as "no". */
export function TutorialAsk({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
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
      <h2 id="tut-ask-title">第一次來嗎？</h2>
      <p>花 20 秒學會「快切」和「慢切」，就知道怎麼用開關調光。</p>
      <div className="tut-ask-actions">
        <button type="button" className="tut-ask-no" onClick={onNo}>
          不用，直接玩
        </button>
        <button type="button" className="tut-ask-yes" onClick={onYes} autoFocus>
          好，教我
        </button>
      </div>
    </dialog>
  );
}
