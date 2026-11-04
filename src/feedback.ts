/** Wall-switch "click" synthesised with WebAudio, plus a short haptic tick on phones. */
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}

export function switchFeedback(on: boolean) {
  try {
    navigator.vibrate?.(on ? 14 : 10);
  } catch {
    /* not supported */
  }
  if (muted) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
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
