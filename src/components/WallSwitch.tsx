import { QUICK_MS } from '../engine/functions';

export interface FingerTap {
  /** increments on every tap so the animation restarts */
  n: number;
  /** which half of the rocker the finger presses: top = turn on, bottom = turn off */
  target: 'top' | 'bottom';
}

interface Props {
  on: boolean;
  offFor: number | null;
  onPress: () => void;
  label: string;
  /** compact = mobile dock size, hint shown elsewhere */
  compact?: boolean;
  /** shown while the 快切 / 慢切 buttons operate the switch */
  finger?: FingerTap | null;
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
  if (inQuick) return <>馬上再按 = <b className="quick">快切</b>（還有 {secs} 秒）</>;
  return <>現在按 = <b className="slow">慢切</b>，回到預設</>;
}

/** A fingertip seen from the front, nail up, tip at the top-left corner of its box. */
function FingerSvg() {
  return (
    <svg viewBox="0 0 44 72" aria-hidden="true">
      <path
        d="M9 6c0-3.3 2.7-6 6-6s6 2.7 6 6v26c2-1.4 6-1.4 7.4 1.6 2.2-1 5.4-.3 6.4 2.4 2.2-.6 5.2.6 5.2 4.2V58c0 8-6 14-14 14h-4C12.6 72 6 66.4 4.6 59L1.2 41c-.6-3 1.6-5.2 4.2-4.6L9 37.6Z"
        fill="#f2cdb0"
        stroke="#b98b6a"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M11.2 6.4c0-2 1.7-3.6 3.8-3.6s3.8 1.6 3.8 3.6v4.8c0 1.2-1 2-2.2 2h-3.2c-1.2 0-2.2-.8-2.2-2Z" fill="#fbe7dc" stroke="#d3a98a" strokeWidth="1" />
      <path d="M21 33v8M28.4 35.6v7M34.8 38v6" stroke="#c99a78" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Wide-plate rocker switch, the common style in Taiwanese homes: an off-white plate with one large
 * rocker set between two chrome-edged gaps. When the light is OFF the top gap opens and its red-orange
 * locator light glows, so the switch can be found in the dark. An outline running round the plate shows
 * the 2-second 快切 window after switching off.
 */
export function WallSwitch({ on, offFor, onPress, label, compact, finger }: Props) {
  const inQuick = !on && offFor !== null && offFor < QUICK_MS;
  const progress = inQuick ? 1 - offFor! / QUICK_MS : 0;

  return (
    <div className={`switch-wrap ${compact ? 'compact' : ''}`}>
      <div className="tw-frame">
        <svg className="tw-progress" viewBox="0 0 200 104" preserveAspectRatio="none" aria-hidden="true">
          {inQuick && (
            <rect x="1.5" y="1.5" width="197" height="101" rx="9" ry="9" pathLength="1" className="ring-progress" strokeDasharray="1 1" strokeDashoffset={1 - progress} />
          )}
          {/* the 快切 window has passed: pressing now is a 慢切 */}
          {!on && offFor !== null && !inQuick && <rect x="1.5" y="1.5" width="197" height="101" rx="9" ry="9" className="ring-slow" />}
        </svg>
        <button
          type="button"
          className={`tw-plate ${on ? 'is-on' : 'is-off'}`}
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
          <span className="tw-well">
            <span className="tw-gap top">
              <span className="tw-led" />
            </span>
            <span className="tw-rocker">
              <i className="tw-dot" />
              <i className="tw-dot" />
            </span>
            <span className="tw-gap bottom" />
          </span>
        </button>
        {finger && (
          <span className={`tw-finger show ${finger.target}`} key={finger.n} aria-hidden="true">
            <FingerSvg />
          </span>
        )}
      </div>
      {!compact && (
        <p className="switch-hint" aria-live="polite">
          <SwitchHint on={on} offFor={offFor} />
        </p>
      )}
    </div>
  );
}
