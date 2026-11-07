import { useEffect, useRef, useState } from 'react';
import { COLOR_LABEL, COLOR_PAIRS, FUNCTIONS, FUNCTION_ORDER, KELVIN, MIN_LEVEL, kelvinLabel, type ColorChoice, type FunctionId } from '../engine/functions';
import type { LightState } from '../engine/switchEngine';
import type { Setup } from '../scenes';
import { FnAnim } from './FnAnim';
import { WallSwitch, type FingerTap } from './WallSwitch';
import type { CoachTarget } from './Tutorial';
import { track } from '../track';

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
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const checkEnd = () => {
    const b = row.current;
    if (b) setEdge({ start: b.scrollLeft <= 4, end: b.scrollLeft + b.clientWidth >= b.scrollWidth - 4 });
  };
  // keep the chosen chip fully in view in the swipeable row (scrolls the row only, never the page)
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('.fn-chip.active');
    const box = row.current;
    if (!el || !box) return;
    const left = el.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft + 8 || left + el.offsetWidth > box.scrollLeft + box.clientWidth - 8) {
      box.scrollTo({ left: Math.max(0, left - (box.clientWidth - el.offsetWidth) / 2), behavior: 'smooth' });
    }
    checkEnd();
  }, [cfg.functionId]);
  if (compact) {
    return (
      <div className="fn-compact">
        <div className={`fn-chips ${edge.start ? '' : 'fade-l'} ${edge.end ? '' : 'fade-r'}`} role="radiogroup" aria-label="開關調光功能" ref={row} onScroll={checkEnd}>
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
          </button>
        );
      })}
    </div>
  );
}

/** Where the light is within its function: the steps, or the colours and the 1–100% bar. */
export function StatusView({ cfg, state }: { cfg: GroupConfig; state: LightState }) {
  const def = FUNCTIONS[cfg.functionId];
  return (
    <div className="status">
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
    </div>
  );
}

/* ------------------------------------------------------------------ status on the picture */

/**
 * The light's state along the bottom of the picture: brightness (and power), plus where it is in the
 * function — the steps, or the 1–100% bar and colours for stepless. The colour name is shown only when it
 * isn't already the choice in the top-left corner.
 */
export function PictureStatus({ cfg, state, power }: { cfg: GroupConfig; state: LightState; power: string }) {
  const def = FUNCTIONS[cfg.functionId];
  const lit = state.switchOn && state.level > 0;
  return (
    <div className={`pic-status ${lit ? 'lit' : ''}`} aria-live="polite">
      <div className="ps-read">
        <b>{state.switchOn ? (state.flashing ? '快閃' : `${pct(state.level)}%`) : '關燈'}</b>
        {state.switchOn && (
          <small>
            {!def.colorSelectable && (
              <>
                <i style={{ background: kelvinSwatch(state.kelvin) }} />
                {kelvinLabel(state.kelvin)}・
              </>
            )}
            {power}
          </small>
        )}
      </div>
      <div className="ps-track">
        <StatusView cfg={cfg} state={state} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 記憶功能 */

/**
 * 記憶功能 toggle, overlaid on the picture's top-right corner. The 慢切 toast on the picture shows what it does.
 */
export function MemoryToggle({ cfg, onConfig }: { cfg: GroupConfig; onConfig: (p: Partial<GroupConfig>) => void }) {
  return (
    <button type="button" role="switch" aria-checked={cfg.memory} className={`mem-toggle ${cfg.memory ? 'on' : ''}`} onClick={() => {
        track('memory_toggle', { on: !cfg.memory });
        onConfig({ memory: !cfg.memory });
      }}>
      記憶功能
      <span className="mem-knob" aria-hidden="true" />
      <b>{cfg.memory ? '開' : '關'}</b>
    </button>
  );
}

/* ------------------------------------------------------------------ 光色 */

/** Colour choice, overlaid on the picture's top-left corner (only for functions where it can be chosen). */
export function ColorPick({ cfg, onConfig }: { cfg: GroupConfig; onConfig: (p: Partial<GroupConfig>) => void }) {
  const def = FUNCTIONS[cfg.functionId];
  if (def.id === 'two-color-stepless') {
    const cur = (cfg.colors ?? def.colors!).join(',');
    return (
      <div className="color-pick" role="radiogroup" aria-label="兩色組合">
        <span className="color-pick-label">光色</span>
        {COLOR_PAIRS.map((p) => {
          const on = p.colors.join(',') === cur;
          return (
            <button key={p.label} type="button" role="radio" aria-checked={on} aria-label={p.label} title={p.label} className={on ? 'active' : ''} onClick={() => {
                track('color_change', { color: p.label });
                onConfig({ colors: p.colors });
              }}>
              {p.colors.map((k) => (
                <i key={k} style={{ background: kelvinSwatch(k) }} />
              ))}
            </button>
          );
        })}
      </div>
    );
  }
  if (!def.colorSelectable) return null;
  return (
    <div className="color-pick" role="radiogroup" aria-label="光色">
      {(Object.keys(KELVIN) as ColorChoice[]).map((c) => {
        const on = cfg.kelvin === KELVIN[c];
        return (
          <button key={c} type="button" role="radio" aria-checked={on} className={on ? 'active' : ''} onClick={() => {
              track('color_change', { color: COLOR_LABEL[c] });
              onConfig({ kelvin: KELVIN[c] });
            }}>
            <i style={{ background: kelvinSwatch(KELVIN[c]) }} />
            {COLOR_LABEL[c]}
          </button>
        );
      })}
    </div>
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
  onDemo?: () => void;
  demoing?: boolean;
}

/** Plays the animated demo of the chosen function. */
export function DemoButton({ cfg, onDemo }: { cfg: GroupConfig; onDemo: () => void }) {
  return (
    <button
      type="button"
      className="link demo-btn"
      onClick={() => {
        track('demo_play', { function: cfg.functionId });
        onDemo();
      }}
    >
      ⓘ {FUNCTIONS[cfg.functionId].plainName}怎麼操作？
    </button>
  );
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

export function ControlPanel({ setup, cfg, state, onConfig, onPress, onQuick, onSlow, busy, finger, tutorial, learning, coach, onDemo, demoing }: Props) {
  return (
    <section className="panel" aria-label={`${setup.fixture.name}控制`}>
      <div className="panel-block switch-block">
        {tutorial}
        <div className="switch-row">
          <WallSwitch on={state.switchOn} offFor={state.offFor} onPress={onPress} label={setup.fixture.name} finger={finger} />
        </div>
        <div className="shortcuts">
          <QuickSlowButtons onQuick={onQuick} onSlow={onSlow} busy={busy} className="btn" coach={coach} />
        </div>
        {!learning && !demoing && onDemo && <DemoButton cfg={cfg} onDemo={onDemo} />}
      </div>
      {!learning && (
        <>
          <div className="panel-block">
            <h3 className="block-title">選一個功能</h3>
            <FunctionPicker cfg={cfg} onConfig={onConfig} />
          </div>
        </>
      )}
    </section>
  );
}
