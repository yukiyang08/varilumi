import { QUICK_MS } from '../engine/functions';

interface Props {
  on: boolean;
  offFor: number | null;
  onPress: () => void;
  disabled?: boolean;
  label: string;
  /** compact = mobile dock: smaller, hint shown elsewhere */
  compact?: boolean;
}

const R = 92;
const CIRC = 2 * Math.PI * R;

export function SwitchHint({ on, offFor }: { on: boolean; offFor: number | null }) {
  const inQuick = !on && offFor !== null && offFor < QUICK_MS;
  const secs = inQuick ? ((QUICK_MS - offFor!) / 1000).toFixed(1) : null;
  if (on) return <>按一下<b>關燈</b></>;
  if (offFor === null) return <>按一下<b>開燈</b></>;
  if (inQuick) return <>現在打開 = <b className="quick">⚡快切</b>（剩 {secs} 秒）</>;
  return <>現在打開 = <b className="slow">🐢慢切</b></>;
}

/** Skeuomorphic rocker switch with a countdown ring that shows the 快切 / 慢切 window while off. */
export function WallSwitch({ on, offFor, onPress, disabled, label, compact }: Props) {
  const inQuick = !on && offFor !== null && offFor < QUICK_MS;
  const progress = inQuick ? 1 - offFor! / QUICK_MS : 0;

  return (
    <div className={`switch-wrap ${compact ? 'compact' : ''}`}>
      <div className="switch-ring">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r={R} className="ring-track" />
          <circle
            cx="100"
            cy="100"
            r={R}
            className="ring-progress"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
            transform="rotate(-90 100 100)"
          />
        </svg>
        <button
          type="button"
          className={`plate ${on ? 'is-on' : 'is-off'}`}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            if (!disabled) onPress();
          }}
          onKeyDown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !disabled) {
              e.preventDefault();
              onPress();
            }
          }}
          aria-pressed={on}
          aria-label={`${label}牆壁開關，目前${on ? '開' : '關'}`}
          disabled={disabled}
        >
          <span className="rocker">
            <span className="rocker-top" />
            <span className="rocker-bottom" />
            <span className="led" />
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
