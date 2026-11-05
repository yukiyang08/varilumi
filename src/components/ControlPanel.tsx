import { COLOR_LABEL, FUNCTIONS, FUNCTION_ORDER, KELVIN, MIN_LEVEL, kelvinLabel, type ColorChoice, type FunctionId } from '../engine/functions';
import type { LightState } from '../engine/switchEngine';
import type { Setup } from '../scenes';
import { FnAnim } from './FnAnim';
import { WallSwitch, type FingerTap } from './WallSwitch';

export interface GroupConfig {
  functionId: FunctionId;
  kelvin: number;
  memory: boolean;
}

export const pct = (l: number) => (l >= 0.995 ? '100' : l < 0.0105 ? '1' : (l * 100).toFixed(l < 0.1 ? 1 : 0));

export function eventText(state: LightState, cfg: GroupConfig): string {
  const def = FUNCTIONS[cfg.functionId];
  const step = def.mode === 'steps' ? def.steps[state.stepIndex] : null;
  const now = step ? step.label : `${pct(state.level)}%`;
  switch (state.event) {
    case 'first':
      return `開燈！預設是 ${now}`;
    case 'step':
      return `⚡快切 → 跳到下一段：${now}`;
    case 'ramp-start':
      return '⚡快切 → 從夜燈開始慢慢變亮…亮度剛好時再連按兩下';
    case 'ramp-stop':
      return `⚡快切 → 停在 ${now}`;
    case 'ramp-done':
      return cfg.memory ? '亮到 100% 了（快閃一下＝自動記憶在 100%）' : '亮到 100% 了';
    case 'slow-default':
      return `🐢慢切 → 回到預設 ${now}`;
    case 'slow-memory':
      return `🐢慢切 → 記憶功能：回到上次的 ${now}`;
    case 'off':
      return '關燈了。馬上再按＝快切，關超過 3 秒再按＝慢切';
    default:
      return '按下開關試試看';
  }
}

/** Rough sRGB swatch for a colour temperature (UI only). */
export function kelvinSwatch(k: number): string {
  if (k >= 5500) return '#f4f6ff';
  if (k >= 4500) return '#fff5e6';
  if (k >= 3600) return '#ffe9c9';
  return '#ffcf8a';
}

/** Position on the stepless bar: linear, so the marker shows the real percentage (1% → 0, 100% → 1). */
const barPos = (l: number) => (Math.max(l, MIN_LEVEL) - MIN_LEVEL) / (1 - MIN_LEVEL);

/* ------------------------------------------------------------------ pieces */

export function FunctionPicker({ cfg, onConfig, compact }: { cfg: GroupConfig; onConfig: (p: Partial<GroupConfig>) => void; compact?: boolean }) {
  const def = FUNCTIONS[cfg.functionId];
  if (compact) {
    return (
      <div className="fn-compact">
        <div className="fn-chips" role="radiogroup" aria-label="開關調光功能">
          {FUNCTION_ORDER.map((id) => {
            const f = FUNCTIONS[id];
            const active = id === cfg.functionId;
            return (
              <button key={id} type="button" role="radio" aria-checked={active} className={`fn-chip ${active ? 'active' : ''}`} onClick={() => onConfig({ functionId: id })}>
                {f.plainName}
              </button>
            );
          })}
        </div>
        <p className="fn-sum-line">
          {def.needDesc}
          <span className="fn-official">　{def.family}</span>
        </p>
      </div>
    );
  }
  return (
    <div className="fn-cards" role="radiogroup" aria-label="開關調光功能">
      {FUNCTION_ORDER.map((id) => {
        const f = FUNCTIONS[id];
        const active = id === cfg.functionId;
        return (
          <button key={id} type="button" role="radio" aria-checked={active} className={`fn-card ${active ? 'active' : ''}`} onClick={() => onConfig({ functionId: id })}>
            <span className="fn-name">{f.plainName}</span>
            <FnAnim id={id} />
            <span className="fn-sum">{f.needDesc}</span>
            <span className="fn-official">
              <span className={`badge ${f.family === '調光型' ? 'dim' : 'tune'}`}>{f.family}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Options({ cfg, onConfig, compact }: { cfg: GroupConfig; onConfig: (p: Partial<GroupConfig>) => void; compact?: boolean }) {
  const def = FUNCTIONS[cfg.functionId];
  return (
    <div className={`opts ${compact ? 'compact' : ''}`}>
      {def.colorSelectable && (
        <div className="opt">
          {!compact && <span className="opt-label">光色（這個功能固定一種光色）</span>}
          <div className="chips" role="radiogroup" aria-label="色溫">
            {(Object.keys(KELVIN) as ColorChoice[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                className={`chip chip-${c} ${cfg.kelvin === KELVIN[c] ? 'active' : ''}`}
                onClick={() => onConfig({ kelvin: KELVIN[c] })}
                aria-checked={cfg.kelvin === KELVIN[c]}
              >
                <i />
                {COLOR_LABEL[c]}
                {!compact && ` ${KELVIN[c]}K`}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="opt toggle">
        <input id={`mem-${compact ? 'm' : 'd'}`} type="checkbox" checked={cfg.memory} onChange={(e) => onConfig({ memory: e.target.checked })} />
        <span className="track-ui" aria-hidden="true" />
        <span>
          <b>記憶功能</b>
          {!compact && <small>慢切開燈時，回到上次關燈前的{def.family === '調色型' ? '色溫' : '亮度'}</small>}
        </span>
      </label>
    </div>
  );
}

export function StatusView({ cfg, state, hideReadout, power }: { cfg: GroupConfig; state: LightState; hideReadout?: boolean; power?: string }) {
  const def = FUNCTIONS[cfg.functionId];
  const lit = state.switchOn && state.level > 0;
  return (
    <div className="status">
      {!hideReadout && (
        <div className={`readout ${lit ? '' : 'dim'}`}>
          <span className="big">{state.switchOn ? (state.flashing ? '✦' : `${pct(state.level)}%`) : '關'}</span>
          <span className="k">
            <i style={{ background: kelvinSwatch(state.kelvin) }} />
            {state.kelvin}K {kelvinLabel(state.kelvin)}
          </span>
          {power && state.switchOn && <span className="watt">耗電 {power}</span>}
        </div>
      )}
      {def.mode === 'steps' ? (
        <ol className="steps" aria-label="段數">
          {def.steps.map((s, i) => (
            <li key={i} className={state.switchOn && i === state.stepIndex ? 'cur' : ''}>
              <span className="dot" style={{ background: kelvinSwatch(s.kelvin ?? cfg.kelvin), opacity: 0.3 + 0.7 * Math.sqrt(s.level) }} />
              {s.label}
            </li>
          ))}
        </ol>
      ) : (
        <div className="ramp" aria-label="無段亮度">
          <div className="ramp-bar" style={{ background: `linear-gradient(90deg, #2a2723, ${kelvinSwatch(state.kelvin)})` }}>
            <span className="ramp-marker" style={{ left: `${(state.switchOn ? barPos(state.level) : 0) * 100}%` }} />
          </div>
          <div className="ramp-ends">
            <span>1% 夜燈</span>
            <span>{state.ramping ? `漸亮中 ${(state.rampProgress * 6).toFixed(1)} / 6 秒` : ''}</span>
            <span>100%</span>
          </div>
        </div>
      )}
      <p className="event" aria-live="polite">{eventText(state, cfg)}</p>
    </div>
  );
}

export function HowTo({ cfg }: { cfg: GroupConfig }) {
  const def = FUNCTIONS[cfg.functionId];
  return (
    <div className="panel-block howto">
      <h3 className="block-title">{def.plainName}怎麼用</h3>
      <ul>
        {def.howTo.map((h) => (
          <li key={h}>{h}</li>
        ))}
        {cfg.memory && <li>記憶功能：慢切開燈會回到上次關燈前的狀態</li>}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ 更多設定 */

export function MoreSettings({ cfg, onConfig, compact }: { cfg: GroupConfig; onConfig: (p: Partial<GroupConfig>) => void; compact?: boolean }) {
  const def = FUNCTIONS[cfg.functionId];
  return (
    <details className="more">
      <summary>
        更多設定<small>{def.colorSelectable ? '光色、' : ''}記憶功能</small>
      </summary>
      <div className="more-body">
        <Options cfg={cfg} onConfig={onConfig} compact={compact} />
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ desktop panel */

interface Props {
  setup: Setup;
  cfg: GroupConfig;
  state: LightState;
  power: string;
  onConfig: (patch: Partial<GroupConfig>) => void;
  onPress: () => void;
  onQuick: () => void;
  onSlow: () => void;
  busy: boolean;
  finger?: FingerTap | null;
  tutorial?: React.ReactNode;
}

/** 🐢慢切 on the left, ⚡快切 on the right. */
export function QuickSlowButtons({ onQuick, onSlow, busy, className }: { onQuick: () => void; onSlow: () => void; busy: boolean; className?: string }) {
  return (
    <>
      <button type="button" className={`${className} slow`} onClick={onSlow} disabled={busy}>
        <b>🐢 慢切</b>
        <small>關超過3秒才開</small>
      </button>
      <button type="button" className={`${className} quick`} onClick={onQuick} disabled={busy}>
        <b>⚡ 快切</b>
        <small>關了馬上開</small>
      </button>
    </>
  );
}

export function ControlPanel({ setup, cfg, state, power, onConfig, onPress, onQuick, onSlow, busy, finger, tutorial }: Props) {
  return (
    <section className="panel" aria-label={`${setup.fixture.name}控制`}>
      <div className="panel-block switch-block">
        {tutorial}
        <div className="switch-row">
          <WallSwitch on={state.switchOn} offFor={state.offFor} onPress={onPress} label={setup.fixture.name} finger={finger} />
          <StatusView cfg={cfg} state={state} power={power} />
        </div>
        <div className="shortcuts">
          <QuickSlowButtons onQuick={onQuick} onSlow={onSlow} busy={busy} className="btn" />
        </div>
      </div>
      <div className="panel-block">
        <h3 className="block-title">選一個功能</h3>
        <FunctionPicker cfg={cfg} onConfig={onConfig} />
      </div>
      <MoreSettings cfg={cfg} onConfig={onConfig} />
      <HowTo cfg={cfg} />
    </section>
  );
}
