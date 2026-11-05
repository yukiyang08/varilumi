import { FLASH_MS, FUNCTIONS, MIN_LEVEL, QUICK_MS, RAMP_HOLD_MS, RAMP_KNEE_LEVEL, RAMP_KNEE_MS, RAMP_MS, type FunctionId } from './functions';

/**
 * Pure state machine for one Varilumi switch-dimming light group.
 * Time is always passed in explicitly (ms), so it is deterministic and easy to test.
 *
 *  快切 quick toggle : off → on within QUICK_MS  → next step / start ramp / stop ramp
 *  慢切 slow toggle  : off → on after QUICK_MS   → default (or memorised) state
 */

export type Action = 'first' | 'quick' | 'slow' | 'off' | null;

/** What the last press did, for UI explanations. */
export type EngineEvent =
  | 'first' | 'off'
  | 'step'          // quick → next step
  | 'ramp-start'    // quick → start 6 s ramp
  | 'ramp-stop'     // quick during ramp → hold level
  | 'ramp-done'     // ramp reached 100% by itself
  | 'slow-default'  // slow → default state
  | 'slow-memory'   // slow → memorised state
  | null;

export interface EngineOptions {
  functionId: FunctionId;
  memory: boolean;
  /** fixed colour temperature for 調光型 functions */
  kelvin: number;
  /** colours for 兩色無段調光 (two of 白/柔/黃); defaults to the function's own list */
  colors?: number[];
}

export interface LightState {
  switchOn: boolean;
  /** effective brightness 0..1 (0 when off or flashing) */
  level: number;
  kelvin: number;
  stepIndex: number;
  stepCount: number;
  /** stepless functions: which colour is on, how many there are, and which one the next 快切 ramps */
  colorIndex: number;
  colorCount: number;
  nextColorIndex: number;
  ramping: boolean;
  /** 0..1 progress of the 6 s ramp */
  rampProgress: number;
  flashing: boolean;
  lastAction: Action;
  event: EngineEvent;
  /** ms since the switch went off (for the quick/slow countdown ring), null when on */
  offFor: number | null;
}

/** 無段調光 brightness over time, as measured on the real driver (piecewise linear, see functions.ts). */
export function rampLevel(elapsed: number): number {
  if (elapsed <= RAMP_HOLD_MS) return MIN_LEVEL;
  if (elapsed <= RAMP_KNEE_MS) {
    return MIN_LEVEL + ((RAMP_KNEE_LEVEL - MIN_LEVEL) * (elapsed - RAMP_HOLD_MS)) / (RAMP_KNEE_MS - RAMP_HOLD_MS);
  }
  if (elapsed >= RAMP_MS) return 1;
  return RAMP_KNEE_LEVEL + ((1 - RAMP_KNEE_LEVEL) * (elapsed - RAMP_KNEE_MS)) / (RAMP_MS - RAMP_KNEE_MS);
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
  private colorIdx = 0; // stepless: colour that is on
  private nextColor = 0; // stepless: colour the next 快切 will ramp
  private memColor = 0;
  private flashAt: number | null = null;
  private lastAction: Action = null;
  private event: EngineEvent = null;

  constructor(opts: EngineOptions) {
    this.opts = { ...opts };
  }

  get options(): EngineOptions {
    return { ...this.opts };
  }

  /**
   * Change function: behaves like installing a new lamp (resets state, light stays off).
   * Turning 記憶功能 on or off keeps the light as it is; switching it on remembers the current state,
   * so the very next 慢切 shows the difference.
   */
  configure(patch: Partial<EngineOptions>, now: number): void {
    const fnChanged = patch.functionId !== undefined && patch.functionId !== this.opts.functionId;
    const memOn = patch.memory === true && !this.opts.memory;
    this.opts = { ...this.opts, ...patch };
    if (memOn && !fnChanged) {
      this.settle(now);
      this.memStep = this.stepIndex;
      if (this.rampStart === null) {
        this.memLevel = this.held;
        this.memColor = this.colorIdx;
      }
    }
    const n = this.colors.length;
    if (this.colorIdx >= n) this.colorIdx = 0;
    if (this.nextColor >= n) this.nextColor = 0;
    if (this.memColor >= n) this.memColor = 0;
    if (fnChanged) {
      this.switchOn = false;
      this.offAt = now - 10 * QUICK_MS; // long enough ago that the next press is a slow one
      this.everOn = false;
      this.stepIndex = 0;
      this.held = 1;
      this.rampStart = null;
      this.memStep = 0;
      this.memLevel = 1;
      this.colorIdx = 0;
      this.nextColor = 0;
      this.memColor = 0;
      this.flashAt = null;
      this.lastAction = null;
      this.event = null;
    }
  }

  private get def() {
    return FUNCTIONS[this.opts.functionId];
  }

  /** 記憶 is either chosen (加記憶功能) or built into the function (記憶兩色/三色無段調光). */
  private get memOn(): boolean {
    return this.opts.memory || !!this.def.memoryBuiltIn;
  }

  /** Colours a stepless function works with: one fixed colour, or the 兩色/三色 list. */
  private get colors(): number[] {
    const d = this.def;
    if (d.mode === 'multi-stepless') return this.opts.colors && d.id === 'two-color-stepless' ? this.opts.colors : d.colors!;
    return [this.opts.kelvin];
  }

  /** Settle a ramp that ran to completion without being stopped. */
  private settle(now: number): void {
    if (this.rampStart === null) return;
    const until = this.switchOn ? now : this.offAt ?? now;
    if (until - this.rampStart >= RAMP_MS) {
      const doneAt = this.rampStart + RAMP_MS;
      this.rampStart = null;
      this.held = 1;
      this.nextColor = (this.colorIdx + 1) % this.colors.length;
      if (this.switchOn) this.event = 'ramp-done';
      if (this.memOn) {
        this.memLevel = 1;
        this.memColor = this.colorIdx;
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
      this.event = 'off';
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
        this.event = 'step';
      } else {
        this.stepIndex = this.memOn ? this.memStep : 0;
        this.event = action === 'first' ? 'first' : this.memOn ? 'slow-memory' : 'slow-default';
      }
      if (this.memOn) this.memStep = this.stepIndex;
    } else {
      // 無段調光 (one colour) and 兩色/三色無段調光 (each new ramp moves on to the next colour)
      const n = this.colors.length;
      const wasRamping = this.rampStart !== null && this.offAt !== null;
      if (quick && wasRamping) {
        // stop the ramp at the level it had reached when the switch went off
        this.held = rampLevel(this.offAt! - this.rampStart!);
        this.rampStart = null;
        this.nextColor = (this.colorIdx + 1) % n;
        if (this.memOn) {
          this.memLevel = this.held;
          this.memColor = this.colorIdx;
        }
        this.event = 'ramp-stop';
      } else if (quick) {
        this.colorIdx = this.nextColor;
        this.rampStart = now;
        this.event = 'ramp-start';
      } else {
        this.rampStart = null;
        this.held = this.memOn ? this.memLevel : 1;
        this.colorIdx = this.memOn ? this.memColor : 0;
        this.nextColor = this.colorIdx; // the first 快切 re-tunes the colour that is on
        this.event = action === 'first' ? 'first' : this.memOn ? 'slow-memory' : 'slow-default';
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
    } else {
      kelvin = this.colors[this.colorIdx];
      if (ramping) {
        rampProgress = Math.min((now - this.rampStart!) / RAMP_MS, 1);
        level = rampLevel(now - this.rampStart!);
      } else {
        level = this.held;
      }
    }

    const flashing = this.flashAt !== null && now >= this.flashAt && now - this.flashAt < FLASH_MS;
    return {
      switchOn: this.switchOn,
      level: this.switchOn && !flashing ? level : 0,
      kelvin,
      stepIndex: def.mode === 'steps' ? this.stepIndex : 0,
      stepCount: def.mode === 'steps' ? def.steps.length : 0,
      colorIndex: def.mode === 'steps' ? 0 : this.colorIdx,
      colorCount: def.mode === 'steps' ? 0 : this.colors.length,
      nextColorIndex: def.mode === 'steps' ? 0 : this.nextColor,
      ramping,
      rampProgress,
      flashing,
      lastAction: this.lastAction,
      event: this.event,
      offFor: this.switchOn || this.offAt === null ? null : now - this.offAt,
    };
  }
}
