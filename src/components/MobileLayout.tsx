import type { LightState } from '../engine/switchEngine';
import type { Setup } from '../scenes';
import { ColorPick, DemoButton, FunctionPicker, MemoryToggle, PictureStatus, QuickSlowButtons, type GroupConfig } from './ControlPanel';
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
  /** demo caption shown on the picture instead of the usual toast */
  demoCaption: React.ReactNode;
  learning: boolean;
  coach: CoachTarget | null;
  onDemo: () => void;
  demoing: boolean;
  after: React.ReactNode;
}

/**
 * Phone layout, built around the one thing visitors came to do — press the switch:
 *  - full-bleed scene on top with the live reading overlaid on the picture
 *  - the function chips in the middle; colour and 記憶功能 sit on the picture
 *  - the wall switch docked at the bottom in thumb reach, 快切 / 慢切 on either side
 */
export function MobileLayout(p: Props) {
  const { state, setup } = p;
  const { learning } = p;

  return (
    <div className="m-app">
      <div className="m-stage">
        <div className="m-picture">
          <SceneView setup={setup} weights={p.weights} />
          {p.demoCaption ?? <SceneToast toast={p.toast} />}
          {!learning && <MemoryToggle cfg={p.cfg} onConfig={p.onConfig} />}
          {!learning && <ColorPick cfg={p.cfg} onConfig={p.onConfig} />}
          <PictureStatus cfg={p.cfg} state={state} power={p.power} />
        </div>
        {/* the choices sit right under the pinned picture: never covering it, always one tap away */}
        <div className="m-crumbs">{p.crumbs}</div>
      </div>

      <div className="m-body">
        {p.card}
        {!learning && <FunctionPicker cfg={p.cfg} onConfig={p.onConfig} compact />}
        {!learning && !p.demoing && <DemoButton cfg={p.cfg} onDemo={p.onDemo} />}
        {!learning && (
          <>
            {p.after}
          </>
        )}
      </div>

      <div className="m-dock" role="group" aria-label={`${setup.fixture.name}牆壁開關`}>
        {/* only while the light is off: counts down the 快切 window (space kept so the dock doesn't jump) */}
        <p className="m-hint" style={{ visibility: state.switchOn ? 'hidden' : 'visible' }}>
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
