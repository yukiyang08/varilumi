export interface Toast {
  key: number;
  memory: boolean;
  /** what the light came back to, e.g. "25%" or "黃光 100%" */
  label: string;
}

/**
 * Shown on the picture right after a 慢切, so the effect of 記憶功能 is impossible to miss:
 * with memory the light comes back to where it was, without it the light resets.
 */
export function SceneToast({ toast }: { toast: Toast | null }) {
  if (!toast) return null;
  return (
    <div className={`scene-toast ${toast.memory ? 'mem' : ''}`} key={toast.key} role="status" aria-live="polite">
      {toast.memory ? (
        <>
          <b>🧠 記憶功能：回到上次的 {toast.label}</b>
        </>
      ) : (
        <>
          <b>慢切：回到預設 {toast.label}</b>
          <small>打開「記憶功能」，就會回到上次的亮度</small>
        </>
      )}
    </div>
  );
}
