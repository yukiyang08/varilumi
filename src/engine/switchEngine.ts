import { FLASH_MS, FUNCTIONS, MIN_LEVEL, QUICK_MS, RAMP_MS, type FunctionId } from './functions';

/**
 * Pure state machine for one Varilumi switch-dimming light group.
 * Time is always passed in explicitly (ms), so it is deterministic and easy to test.
 *
 *  快切 quick toggle : off → on within QUICK_MS  → next step / start ramp / stop ramp
 *  慢切 slow toggle  : off → on after QUICK_MS   → default (or memorised) state
 */

export type Action = 'first' | 'quick' | 'slow' | 'off' | null;

export interface EngineOptions {
  functionId: FunctionId;
  memory: boolean;
  /** fixed colour temperature for 調光型 functions */
  kelvin: number;
}

export interface LightState {
  switchOn: boolean;
  /** effective brightness 0..1 (0 when off or flashing) */
  level: number;
  kelvin: number;
  stepIndex: number;
  stepCount: number;
  ramping: boolean;
  /** 0..1 progress of the 6 s ramp */
  rampProgress: number;
  flashing: boolean;
  lastAction: Action;
  /** ms since the switch went off (for the quick/slow countdown ring), null when on */
  offFor: number | null;
}

/** Perceptual ramp: 1% → 100% exponentially over RAMP_MS (looks linear to the eye). */
export function rampLevel(elapsed: number): number {
  const t = Math.min(Math.max(elapsed / RAMP_MS, 0), 1);
  return MIN_LEVEL * Math.pow(1 / MIN_LEVEL, t);
}

export class SwitchEngine {
  private opts: EngineOptions;
  private switchOn = false;
  private offAt: number | null = null;
  private everOn = false;
  private stepIndex = 0;
  private held = 1; // stepless held level
  private rampStart: number | null = null;
  private memStep = 0;
  private memLevel = 1;
  private flashAt: number | null = null;
  private lastAction: Action = null;

  constructor(opts: EngineOptions) {
    this.opts = { ...opts };
  }

  get options(): EngineOptions {
    return { ...this.opts };
  }

  /** Change function / memory: behaves like installing a new lamp (resets state, light stays off). */
  configure(patch: Partial<EngineOptions>, now: number): void {
    const fnChanged = patch.functionId !== undefined && patch.functionId !== this.opts.functionId;
    const memChanged = patch.memory !== undefined && patch.memory !== this.opts.memory;
    this.opts = { ...this.opts, ...patch };
    if (fnChanged || memChanged) {
      this.switchOn = false;
      this.offAt = now - 10 * QUICK_MS; // long enough ago that the next press is a slow one
      this.everOn = false;
      this.stepIndex = 0;
      this.held = 1;
      this.rampStart = null;
      this.memStep = 0;
      this.memLevel = 1;
      this.flashAt = null;
      this.lastAction = null;
    }
  }

  private get def() {
    return FUNCTIONS[this.opts.functionId];
  }

  /** Settle a ramp that ran to completion without being stopped. */
  private settle(now: number): void {
    if (this.rampStart === null) return;
    const until = this.switchOn ? now : this.offAt ?? now;
    if (until - this.rampStart >= RAMP_MS) {
      const doneAt = this.rampStart + RAMP_MS;
      this.rampStart = null;
      this.held = 1;
      if (this.opts.memory) {
        this.memLevel = 1;
        this.flashAt = doneAt; // flash once to show "memorised at 100%"
      }
    }
  }

  /** Flip the wall switch. */
  press(now: number): Action {
    this.settle(now);
    if (this.switchOn) {
      this.switchOn = false;
      this.offAt = now;
      this.lastAction = 'off';
      return 'off';
    }

    const quick = this.everOn && this.offAt !== null && now - this.offAt < QUICK_MS;
    const action: Action = !this.everOn ? 'first' : quick ? 'quick' : 'slow';
    this.switchOn = true;
    this.everOn = true;
    this.flashAt = null;

    if (this.def.mode === 'steps') {
      if (quick) {
        this.stepIndex = (this.stepIndex + 1) % this.def.steps.length;
      } else {
        this.stepIndex = this.opts.memory ? this.memStep : 0;
      }
      if (this.opts.memory) this.memStep = this.stepIndex;
    } else {
      const wasRamping = this.rampStart !== null && this.offAt !== null;
      if (quick && wasRamping) {
        // stop the ramp at the level it had reached when the switch went off
        this.held = rampLevel(this.offAt! - this.rampStart!);
        this.rampStart = null;
        if (this.opts.memory) this.memLevel = this.held;
      } else if (quick) {
        this.rampStart = now;
      } else {
        this.rampStart = null;
        this.held = this.opts.memory ? this.memLevel : 1;
      }
    }
    this.lastAction = action;
    return action;
  }

  state(now: number): LightState {
    this.settle(now);
    const def = this.def;
    let level: number;
    let kelvin = this.opts.kelvin;
    let rampProgress = 0;
    const ramping = this.rampStart !== null && this.switchOn;

    if (def.mode === 'steps') {
      const step = def.steps[this.stepIndex];
      level = step.level;
      if (step.kelvin) kelvin = step.kelvin;
    } else if (ramping) {
      rampProgress = Math.min((now - this.rampStart!) / RAMP_MS, 1);
      level = rampLevel(now - this.rampStart!);
    } else {
      level = this.held;
      rampProgress = 0;
    }

    const flashing = this.flashAt !== null && now >= this.flashAt && now - this.flashAt < FLASH_MS;
    return {
      switchOn: this.switchOn,
      level: this.switchOn && !flashing ? level : 0,
      kelvin,
      stepIndex: def.mode === 'steps' ? this.stepIndex : 0,
      stepCount: def.mode === 'steps' ? def.steps.length : 0,
      ramping,
      rampProgress,
      flashing,
      lastAction: this.lastAction,
      offFor: this.switchOn || this.offAt === null ? null : now - this.offAt,
    };
  }
}
