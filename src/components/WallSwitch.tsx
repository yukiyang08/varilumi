import { QUICK_MS } from '../engine/functions';

interface Props {
  on: boolean;
  offFor: number | null;
  onPress: () => void;
  label: string;
  /** compact = mobile dock size, hint shown elsewhere */
  compact?: boolean;
}

/** What pressing the switch right now will do, in the visitor's words. */
export function SwitchHint({ on, offFor }: { on: boolean; offFor: number | null }) {
  const inQuick = !on && offFor !== null && offFor < QUICK_MS;
  const secs = inQuick ? ((QUICK_MS - offFor!) / 1000).toFixed(1) : null;
  if (on)
    return (
      <>
        <span className="hp"><b>連按兩下</b>換下一段</span>
        <span className="sep">・</span>
        <span className="hp"><b>按一下</b>關燈</span>
      </>
    );
  if (offFor === null) return <>按一下<b>開燈</b></>;
  if (inQuick) return <>馬上再按 = <b className="quick">⚡快切</b>（還有 {secs} 秒）</>;
  return <>現在按 = <b className="slow">慢切</b>，回到預設</>;
}

/**
 * Wide-plate rocker switch as found in most Taiwanese homes, with the orange locator
 * light that glows while the switch is off. A progress outline around the plate shows
 * the 2-second 快切 window after switching off.
 */
export function WallSwitch({ on, offFor, onPress, label, compact }: Props) {
  const inQuick = !on && offFor !== null && offFor < QUICK_MS;
  const progress = inQuick ? 1 - offFor! / QUICK_MS : 0;

  return (
    <div className={`switch-wrap ${compact ? 'compact' : ''}`}>
      <div className="switch-frame">
        <svg className="switch-progress" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
          {inQuick && (
            <rect x="2" y="2" width="96" height="146" rx="14" ry="14" pathLength="1" className="ring-progress" strokeDasharray="1 1" strokeDashoffset={1 - progress} />
          )}
        </svg>
        <button
          type="button"
          className={`plate ${on ? 'is-on' : 'is-off'}`}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            onPress();
          }}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onPress();
            }
          }}
          aria-pressed={on}
          aria-label={`${label}牆壁開關，目前${on ? '開' : '關'}。連按兩下換下一段`}
        >
          <span className="rocker">
            <span className="locator" />
          </span>
        </button>
      </div>
      {!compact && (
        <p className="switch-hint" aria-live="polite">
          <SwitchHint on={on} offFor={offFor} />
        </p>
      )}
    </div>
  );
}
