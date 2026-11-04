import { FUNCTIONS, kelvinLabel } from '../engine/functions';
import type { LightState } from '../engine/switchEngine';
import type { Setup } from '../scenes';
import { FunctionPicker, HowTo, MoreSettings, QuickSlowButtons, StatusView, kelvinSwatch, pct, type GroupConfig } from './ControlPanel';
import { SceneView } from './SceneView';
import { TUT_DONE, TUT_STEPS } from './Tutorial';
import { SwitchHint, WallSwitch } from './WallSwitch';

interface Props {
  setup: Setup;
  state: LightState;
  power: string;
  cfg: GroupConfig;
  weights: Record<string, number>;
  onConfig: (p: Partial<GroupConfig>) => void;
  onPress: () => void;
  onQuick: () => void;
  onSlow: () => void;
  busy: boolean;
  crumbs: React.ReactNode;
  tut: { step: number; onSkip: () => void; onClose: () => void } | null;
  after: React.ReactNode;
}

/**
 * Phone layout, built around the one thing visitors came to do — press the switch:
 *  - full-bleed scene on top with the live reading overlaid on the picture
 *  - the function chips in the middle, everything else under 更多設定
 *  - the wall switch docked at the bottom in thumb reach, 快切 / 慢切 on either side
 */
export function MobileLayout(p: Props) {
  const { state, setup } = p;
  const def = FUNCTIONS[p.cfg.functionId];
  const lit = state.switchOn && state.level > 0;
  const tutDone = p.tut && p.tut.step >= TUT_STEPS.length;
  const tutLine = p.tut ? (tutDone ? TUT_DONE : TUT_STEPS[p.tut.step]) : null;

  return (
    <div className="m-app">
      <div className="m-stage">
        <div className="m-picture">
          <SceneView setup={setup} weights={p.weights} />
          <div className={`m-readout ${lit ? 'lit' : ''}`} aria-live="polite">
            <span className="m-big">{state.switchOn ? (state.flashing ? '✦' : `${pct(state.level)}%`) : '關燈'}</span>
            {state.switchOn && (
              <span className="m-k">
                <i style={{ background: kelvinSwatch(state.kelvin) }} />
                {kelvinLabel(state.kelvin)}・{p.power}
              </span>
            )}
          </div>
        </div>
        {/* the choices sit right under the pinned picture: never covering it, always one tap away */}
        <div className="m-crumbs">{p.crumbs}</div>
      </div>

      <div className="m-body">
        <FunctionPicker cfg={p.cfg} onConfig={p.onConfig} compact />
        <div className="m-status">
          <StatusView cfg={p.cfg} state={state} hideReadout />
        </div>
        <MoreSettings cfg={p.cfg} onConfig={p.onConfig} compact />
        <HowTo cfg={p.cfg} />
        {p.after}
      </div>

      <div className="m-dock" role="group" aria-label={`${setup.fixture.name}牆壁開關`}>
        {p.tut && tutLine ? (
          <div className={`m-tut ${tutDone ? 'done' : ''}`} role="status" aria-live="polite">
            {!tutDone && (
              <span className="m-tut-dots" aria-hidden="true">
                {TUT_STEPS.map((_, i) => (
                  <i key={i} className={i < p.tut!.step ? 'ok' : i === p.tut!.step ? 'cur' : ''} />
                ))}
              </span>
            )}
            <span className="m-tut-text">
              <b>
                {tutDone ? '🎉 ' : `${p.tut.step + 1}. `}
                {tutLine.title}
              </b>
            </span>
            <button type="button" className="link" onClick={tutDone ? p.tut.onClose : p.tut.onSkip}>
              {tutDone ? '關閉' : '略過'}
            </button>
          </div>
        ) : (
          <p className="m-hint">
            <span className="m-dock-name">
              {setup.room.name}{setup.fixture.name}・{def.plainName}
            </span>
            <span className="m-dock-hint">
              <SwitchHint on={state.switchOn} offFor={state.offFor} />
            </span>
          </p>
        )}
        <div className="m-dock-row">
          <QuickSlowButtons onQuick={p.onQuick} onSlow={p.onSlow} busy={p.busy} className="m-side" short />
          <WallSwitch on={state.switchOn} offFor={state.offFor} onPress={p.onPress} label={setup.fixture.name} compact />
        </div>
      </div>
    </div>
  );
}
