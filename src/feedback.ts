/** Wall-switch "click" synthesised with WebAudio, plus a short haptic tick on phones. */
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}

function audio(): AudioContext {
  return (ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)());
}

/**
 * Browsers only let audio start inside a real tap. The 快切 / 慢切 buttons flip the switch a moment later
 * from a timer, so they call this in their click handler; otherwise the first "off" click is swallowed.
 */
export function unlockAudio() {
  try {
    const c = audio();
    if (c.state === 'suspended') void c.resume();
  } catch {
    /* audio unavailable */
  }
}

export function switchFeedback(on: boolean) {
  try {
    navigator.vibrate?.(on ? 14 : 10);
  } catch {
    /* not supported */
  }
  if (muted) return;
  try {
    const c = audio();
    // still waking up: play once it is running instead of scheduling into a frozen clock
    if (c.state === 'suspended') c.resume().then(() => click(c, on), () => undefined);
    else click(c, on);
  } catch {
    /* audio unavailable */
  }
}

function click(ctx: AudioContext, on: boolean) {
  try {
    const t = ctx.currentTime;
    // sharp plastic "tick": filtered noise burst
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = on ? 3200 : 2600;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = 0.55;
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(t);
    // low body thump
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(on ? 180 : 150, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.05);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.25, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(og).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.07);
  } catch {
    /* audio unavailable */
  }
}
