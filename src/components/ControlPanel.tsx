import { COLOR_LABEL, FUNCTIONS, FUNCTION_ORDER, KELVIN, MIN_LEVEL, kelvinLabel, type ColorChoice, type FunctionId } from '../engine/functions';
import type { LightState } from '../engine/switchEngine';
import type { LightGroupDef } from '../scenes';
import { WallSwitch } from './WallSwitch';

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
      return '⚡快切 → 從夜燈開始慢慢變亮…喜歡的亮度再快切一次';
    case 'ramp-stop':
      return `⚡快切 → 停在 ${now}`;
    case 'ramp-done':
      return cfg.memory ? '亮到 100% 了（快閃一下＝自動記憶在 100%）' : '亮到 100% 了';
    case 'slow-default':
      return `🐢慢切 → 回到預設 ${now}`;
    case 'slow-memory':
      return `🐢慢切 → 記憶功能：回到上次的 ${now}`;
    case 'off':
      return '關燈中…';
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

/** Position on the stepless bar: perceptual (log) scale, 1% → 0, 100% → 1. */
const barPos = (l: number) => Math.log(Math.max(l, MIN_LEVEL) / MIN_LEVEL) / Math.log(1 / MIN_LEVEL);

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
                <span className={`badge ${f.family === '調光型' ? 'dim' : 'tune'}`}>{f.family}</span>
                {f.name}
              </button>
            );
          })}
        </div>
        <p className="fn-sum-line">{def.summary}</p>
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
            <span className={`badge ${f.family === '調光型' ? 'dim' : 'tune'}`}>{f.family}</span>
            <span className="fn-name">{f.name}</span>
            <span className="fn-sum">{f.summary}</span>
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
          {!compact && <span className="opt-label">色溫（固定一種）</span>}
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

export function StatusView({ cfg, state, hideReadout }: { cfg: GroupConfig; state: LightState; hideReadout?: boolean }) {
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
      <h3 className="block-title">{def.name}怎麼用</h3>
      <ul>
        {def.howTo.map((h) => (
          <li key={h}>{h}</li>
        ))}
        {cfg.memory && <li>記憶功能：慢切開燈會回到上次關燈前的狀態</li>}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ desktop panel */

interface Props {
  group: LightGroupDef;
  cfg: GroupConfig;
  state: LightState;
  busy: boolean;
  onConfig: (patch: Partial<GroupConfig>) => void;
  onPress: () => void;
  onQuick: () => void;
  onSlow: () => void;
  tutorial?: React.ReactNode;
}

export function ControlPanel({ group, cfg, state, busy, onConfig, onPress, onQuick, onSlow, tutorial }: Props) {
  return (
    <section className="panel" aria-label={`${group.name}控制`}>
      <div className="panel-block switch-block">
        {tutorial}
        <div className="switch-row">
          <WallSwitch on={state.switchOn} offFor={state.offFor} onPress={onPress} disabled={busy} label={group.name} />
          <StatusView cfg={cfg} state={state} />
        </div>
        <div className="shortcuts">
          <button type="button" className="btn quick" onClick={onQuick} disabled={busy}>
            ⚡ 快切<small>關了馬上開</small>
          </button>
          <button type="button" className="btn slow" onClick={onSlow} disabled={busy}>
            🐢 慢切<small>關超過 2 秒再開</small>
          </button>
        </div>
      </div>
      <div className="panel-block">
        <h3 className="block-title">選一個功能</h3>
        <FunctionPicker cfg={cfg} onConfig={onConfig} />
        <Options cfg={cfg} onConfig={onConfig} />
      </div>
      <HowTo cfg={cfg} />
    </section>
  );
}
