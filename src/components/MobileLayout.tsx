import { FUNCTIONS, kelvinLabel } from '../engine/functions';
import type { LightState } from '../engine/switchEngine';
import type { Setup } from '../scenes';
import { FunctionPicker, MemoryToggle, MoreSettings, QuickSlowButtons, StatusView, kelvinSwatch, pct, type GroupConfig } from './ControlPanel';
import { SceneView } from './SceneView';
import { SceneToast, type Toast } from './SceneToast';
import type { CoachTarget } from './Tutorial';
import { SwitchHint, WallSwitch, type FingerTap } from './WallSwitch';

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
  finger: FingerTap | null;
  toast: Toast | null;
  crumbs: React.ReactNode;
  card: React.ReactNode;
  learning: boolean;
  coach: CoachTarget | null;
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
  const { learning } = p;

  return (
    <div className="m-app">
      <div className="m-stage">
        <div className="m-picture">
          <SceneView setup={setup} weights={p.weights} />
          <SceneToast toast={p.toast} />
          {!learning && <MemoryToggle cfg={p.cfg} onConfig={p.onConfig} />}
          <div className={`m-readout ${lit ? 'lit' : ''}`} aria-live="polite">
            <span className="m-big">{state.switchOn ? (state.flashing ? '快閃' : `${pct(state.level)}%`) : '關燈'}</span>
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
        {p.card}
        {!learning && <FunctionPicker cfg={p.cfg} onConfig={p.onConfig} compact />}
        <div className="m-status">
          <StatusView cfg={p.cfg} state={state} hideReadout />
        </div>
        {!learning && (
          <>
            <MoreSettings cfg={p.cfg} onConfig={p.onConfig} compact />
            {p.after}
          </>
        )}
      </div>

      <div className="m-dock" role="group" aria-label={`${setup.fixture.name}牆壁開關`}>
        <p className="m-hint">
          <span className="m-dock-name">
            {setup.room.name}{setup.fixture.name}・{def.plainName}
          </span>
          <span className="m-dock-hint">
            <SwitchHint on={state.switchOn} offFor={state.offFor} />
          </span>
        </p>
        <div className="m-dock-row">
          <QuickSlowButtons onQuick={p.onQuick} onSlow={p.onSlow} busy={p.busy} className="m-side" coach={p.coach} />
          <WallSwitch on={state.switchOn} offFor={state.offFor} onPress={p.onPress} label={setup.fixture.name} compact finger={p.finger} />
        </div>
      </div>
    </div>
  );
}
