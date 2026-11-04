import { FUNCTIONS, kelvinLabel } from '../engine/functions';
import type { LightState } from '../engine/switchEngine';
import { SCENES, type FixtureId, type LightGroupDef, type SceneDef } from '../scenes';
import { FunctionPicker, HowTo, Options, StatusView, kelvinSwatch, pct, type GroupConfig } from './ControlPanel';
import { SceneView } from './SceneView';
import { SwitchHint, WallSwitch } from './WallSwitch';

interface Props {
  scene: SceneDef;
  onScene: (id: SceneDef['id']) => void;
  group: LightGroupDef;
  onGroup: (id: FixtureId) => void;
  states: Record<string, LightState>;
  cfg: GroupConfig;
  busy: boolean;
  weights: Record<string, number>;
  onConfig: (p: Partial<GroupConfig>) => void;
  onPress: () => void;
  onQuick: () => void;
  onSlow: () => void;
  tut: { step: number; onSkip: () => void; onClose: () => void } | null;
  after: React.ReactNode;
}

const MOBILE_TUT = [
  <><b>① 開燈：</b>按一下中間的開關</>,
  <><b>② 快切：</b>按「⚡快切」，看燈怎麼變</>,
  <><b>③ 慢切：</b>按「🐢慢切」，燈回到預設</>,
  <><b>學會了！🎉</b> 換其他功能試試看</>,
];

/**
 * Phone layout, built like a remote control:
 *  - full-bleed scene on top with the live reading overlaid on the picture
 *  - settings in the middle (swipeable function chips, colour + memory on one row)
 *  - the wall switch docked at the bottom in thumb reach, 快切 / 慢切 on either side
 */
export function MobileLayout(p: Props) {
  const state = p.states[p.group.id];
  const def = FUNCTIONS[p.cfg.functionId];
  const lit = state.switchOn && state.level > 0;

  return (
    <div className="m-app">
      <div className="m-stage">
        <SceneView scene={p.scene} weights={p.weights} />
        <div className="m-scene-tabs" role="group" aria-label="場景">
          {SCENES.map((s) => (
            <button key={s.id} type="button" className={s.id === p.scene.id ? 'active' : ''} aria-pressed={s.id === p.scene.id} onClick={() => p.onScene(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <div className={`m-readout ${lit ? 'lit' : ''}`} aria-live="polite">
          <span className="m-big">{state.switchOn ? (state.flashing ? '✦' : `${pct(state.level)}%`) : '關燈'}</span>
          {state.switchOn && (
            <span className="m-k">
              <i style={{ background: kelvinSwatch(state.kelvin) }} />
              {kelvinLabel(state.kelvin)} {state.kelvin}K
            </span>
          )}
        </div>
      </div>

      <div className="m-body">
        {p.scene.groups.length > 1 && (
          <div className="m-seg" role="tablist" aria-label="燈具">
            {p.scene.groups.map((g) => {
              const s = p.states[g.id];
              return (
                <button key={g.id} type="button" role="tab" aria-selected={g.id === p.group.id} className={g.id === p.group.id ? 'active' : ''} onClick={() => p.onGroup(g.id)}>
                  <span className={`lamp ${s.switchOn && s.level > 0 ? 'on' : ''}`} aria-hidden="true" />
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
        <p className="m-group-detail">
          正在控制：<b>{p.group.name}</b>　{p.group.detail}
        </p>

        <FunctionPicker cfg={p.cfg} onConfig={p.onConfig} compact />
        <Options cfg={p.cfg} onConfig={p.onConfig} compact />

        <div className="m-status">
          <StatusView cfg={p.cfg} state={state} hideReadout />
        </div>

        <HowTo cfg={p.cfg} />
        {p.after}
      </div>

      <div className="m-dock" role="group" aria-label={`${p.group.name}牆壁開關`}>
        {p.tut ? (
          <div className={`m-tut ${p.tut.step >= 3 ? 'done' : ''}`} role="status" aria-live="polite">
            <span className="m-tut-dots" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <i key={i} className={i < p.tut!.step ? 'ok' : i === p.tut!.step ? 'cur' : ''} />
              ))}
            </span>
            <span className="m-tut-text">{MOBILE_TUT[Math.min(p.tut.step, 3)]}</span>
            <button type="button" className="link" onClick={p.tut.step >= 3 ? p.tut.onClose : p.tut.onSkip}>
              {p.tut.step >= 3 ? '關閉' : '略過'}
            </button>
          </div>
        ) : (
          <p className="m-hint">
            <span className="m-dock-name">{p.group.name}・{def.name}</span>
            <span>
              <SwitchHint on={state.switchOn} offFor={state.offFor} />
            </span>
          </p>
        )}
        <div className="m-dock-row">
          <button type="button" className="m-side quick" onClick={p.onQuick} disabled={p.busy}>
            <b>⚡ 快切</b>
            <small>關了馬上開</small>
          </button>
          <WallSwitch on={state.switchOn} offFor={state.offFor} onPress={p.onPress} disabled={p.busy} label={p.group.name} compact />
          <button type="button" className="m-side slow" onClick={p.onSlow} disabled={p.busy}>
            <b>🐢 慢切</b>
            <small>關 2 秒再開</small>
          </button>
        </div>
      </div>
    </div>
  );
}
