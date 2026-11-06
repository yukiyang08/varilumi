import { useEffect, useRef } from 'react';
import { COLOR_LABEL, COLOR_PAIRS, FUNCTIONS, FUNCTION_ORDER, KELVIN, MIN_LEVEL, kelvinLabel, type ColorChoice, type FunctionId } from '../engine/functions';
import type { LightState } from '../engine/switchEngine';
import type { Setup } from '../scenes';
import { FnAnim } from './FnAnim';
import { WallSwitch, type FingerTap } from './WallSwitch';
import type { CoachTarget } from './Tutorial';

export interface GroupConfig {
  functionId: FunctionId;
  kelvin: number;
  memory: boolean;
  /** 兩色無段調光: the chosen pair of colours */
  colors?: number[];
}

export const pct = (l: number) => (l >= 0.995 ? '100' : l < 0.0105 ? '1' : (l * 100).toFixed(l < 0.1 ? 1 : 0));

/** What the lamp shows, in the same words as the step chips: "25%", "黃光夜燈", "柔光 35%". */
export function stateLabel(functionId: FunctionId, state: { stepIndex: number; level: number; kelvin: number }): string {
  const def = FUNCTIONS[functionId];
  if (def.mode === 'steps') return def.steps[state.stepIndex].label;
  if (def.mode === 'multi-stepless') return `${kelvinLabel(state.kelvin)} ${pct(state.level)}%`;
  return `${pct(state.level)}%`;
}

export function eventText(state: LightState, cfg: GroupConfig): string {
  const def = FUNCTIONS[cfg.functionId];
  const now = stateLabel(cfg.functionId, state);
  const multi = def.mode === 'multi-stepless';
  switch (state.event) {
    case 'first':
      return `開燈！預設是 ${now}`;
    case 'step':
      return `快切 → 跳到下一段：${now}`;
    case 'ramp-start':
      return multi
        ? `快切 → ${kelvinLabel(state.kelvin)}從夜燈開始慢慢變亮…亮度剛好時再快切停住`
        : '快切 → 從夜燈開始慢慢變亮…亮度剛好時再連按兩下';
    case 'ramp-stop':
      return `快切 → 停在 ${now}`;
    case 'ramp-done':
      return cfg.memory ? '亮到 100%：快閃一下＝已自動記憶在 100%' : '亮到 100% 了';
    case 'slow-default':
      return `慢切 → 沒記憶，回到預設 ${now}`;
    case 'slow-memory':
      return `慢切 → 有記憶，回到關燈前的 ${now}，不必重調`;
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
  const row = useRef<HTMLDivElement>(null);
  // keep the chosen chip fully in view in the swipeable row (scrolls the row only, never the page)
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('.fn-chip.active');
    const box = row.current;
    if (!el || !box) return;
    const left = el.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft + 8 || left + el.offsetWidth > box.scrollLeft + box.clientWidth - 8) {
      box.scrollTo({ left: Math.max(0, left - (box.clientWidth - el.offsetWidth) / 2), behavior: 'smooth' });
    }
  }, [cfg.functionId]);
  if (compact) {
    return (
      <div className="fn-compact">
        <div className="fn-chips" role="radiogroup" aria-label="開關調光功能" ref={row}>
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
          <span className="big">{state.switchOn ? (state.flashing ? '快閃' : `${pct(state.level)}%`) : '關'}</span>
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
        <>
        {def.mode === 'multi-stepless' && (
          <ol className="steps colors" aria-label="光色">
            {Array.from({ length: state.colorCount }, (_, i) => i).map((i) => {
              const k = (cfg.colors && def.id === 'two-color-stepless' ? cfg.colors : def.colors!)[i];
              return (
                <li key={i} className={state.switchOn && i === state.colorIndex ? 'cur' : ''}>
                  <span className="dot" style={{ background: kelvinSwatch(k) }} />
                  {kelvinLabel(k)}
                  {state.switchOn && !state.ramping && i === state.nextColorIndex && i !== state.colorIndex && <em className="next">下次快切</em>}
                </li>
              );
            })}
          </ol>
        )}
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
        </>
      )}
      <p className="event" aria-live="polite">{eventText(state, cfg)}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ 記憶功能 */

/**
 * 記憶功能 toggle, overlaid on the picture's top-right corner. The 慢切 toast on the picture shows what it does.
 */
export function MemoryToggle({ cfg, onConfig }: { cfg: GroupConfig; onConfig: (p: Partial<GroupConfig>) => void }) {
  return (
    <button type="button" role="switch" aria-checked={cfg.memory} className={`mem-toggle ${cfg.memory ? 'on' : ''}`} onClick={() => onConfig({ memory: !cfg.memory })}>
      記憶功能
      <span className="mem-knob" aria-hidden="true" />
      <b>{cfg.memory ? '開' : '關'}</b>
    </button>
  );
}

/* ------------------------------------------------------------------ 更多設定 */

export function MoreSettings({ cfg, onConfig, compact }: { cfg: GroupConfig; onConfig: (p: Partial<GroupConfig>) => void; compact?: boolean }) {
  const def = FUNCTIONS[cfg.functionId];
  if (def.id === 'two-color-stepless') {
    const cur = (cfg.colors ?? def.colors!).join(',');
    return (
      <details className="more">
        <summary>
          換光色組合<small>兩色溫自由選擇</small>
        </summary>
        <div className="more-body">
          <div className="chips" role="radiogroup" aria-label="兩色組合">
            {COLOR_PAIRS.map((p) => (
              <button
                key={p.label}
                type="button"
                role="radio"
                aria-checked={p.colors.join(',') === cur}
                className={`chip ${p.colors.join(',') === cur ? 'active' : ''}`}
                onClick={() => onConfig({ colors: p.colors })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </details>
    );
  }
  if (!def.colorSelectable) return null;
  return (
    <details className="more">
      <summary>
        換光色<small>白光・柔光・黃光</small>
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
  /** first visit, tutorial running: only the switch is shown */
  learning?: boolean;
  coach?: CoachTarget | null;
}

/** 慢切 on the left, 快切 on the right. */
export function QuickSlowButtons({ onQuick, onSlow, busy, className, coach }: { onQuick: () => void; onSlow: () => void; busy: boolean; className?: string; coach?: CoachTarget | null }) {
  return (
    <>
      <button type="button" className={`${className} slow ${coach === 'slow' ? 'coach' : ''}`} onClick={onSlow} disabled={busy}>
        <b>慢切</b>
        <small>關超過3秒才開</small>
      </button>
      <button type="button" className={`${className} quick ${coach === 'quick' ? 'coach' : ''}`} onClick={onQuick} disabled={busy}>
        <b>快切</b>
        <small>關了馬上開</small>
      </button>
    </>
  );
}

export function ControlPanel({ setup, cfg, state, power, onConfig, onPress, onQuick, onSlow, busy, finger, tutorial, learning, coach }: Props) {
  return (
    <section className="panel" aria-label={`${setup.fixture.name}控制`}>
      <div className="panel-block switch-block">
        {tutorial}
        <div className="switch-row">
          <WallSwitch on={state.switchOn} offFor={state.offFor} onPress={onPress} label={setup.fixture.name} finger={finger} />
          <StatusView cfg={cfg} state={state} power={power} />
        </div>
        <div className="shortcuts">
          <QuickSlowButtons onQuick={onQuick} onSlow={onSlow} busy={busy} className="btn" coach={coach} />
        </div>
      </div>
      {!learning && (
        <>
          <div className="panel-block">
            <h3 className="block-title">選一個功能</h3>
            <FunctionPicker cfg={cfg} onConfig={onConfig} />
          </div>
          <MoreSettings cfg={cfg} onConfig={onConfig} />
        </>
      )}
    </section>
  );
}
