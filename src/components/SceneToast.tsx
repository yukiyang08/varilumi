export interface Toast {
  key: number;
  /** slow = after a 慢切; flash = 無段調光 with memory reached 100% by itself and flashed */
  kind: 'slow' | 'flash' | 'quick';
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
      {toast.kind === 'quick' ? (
        <b>快切 → {toast.label} ✓</b>
      ) : toast.kind === 'flash' ? (
        <b>快閃一下＝已自動記憶在 100%</b>
      ) : toast.memory ? (
        <b>有記憶：回到關燈前的 {toast.label}，不必重調</b>
      ) : (
        <>
          <b>沒記憶：回到預設 {toast.label}</b>
          <small>想要其他亮度，再快切重調；或在右上角打開記憶功能</small>
        </>
      )}
    </div>
  );
}
