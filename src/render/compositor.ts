/**
 * WebGL light-layer compositor.
 *
 * Each layer image is one light group rendered alone at 100% (linear radiance, squeezed into 8-bit by
 * blender/encode_layers.py). Light adds linearly, so
 *     radiance = base + Σ weight_i · layer_i
 * is physically exact. We then apply eye adaptation, a filmic tone curve and sRGB output.
 */

export interface LayerMeta {
  width: number;
  height: number;
  layers: Record<string, { meanLum: number }>;
}

const MAX_LAYERS = 4;
/** Dusk-window ambient as a fraction of the fixture's full-power light. Relative to the fixture, not the
 *  render: recessed/track renders came out ~20-70x dimmer than ceiling/cove (Blender spot power only leaves
 *  through the cone), so a fixed ambient weight drowned their 1% glow in window light. */
const BASE_FRAC = 0.012;
/** Mean scene luminance that "all lights on" is normalised to, so every room shows at a similar brightness. */
const TARGET_LUM = 0.28; // was 0.42: full brightness read as washed out, flat walls and ceiling
/** How far the eye opens up as the room dims: exposure × (full / current)^ADAPT_EXP, at most ADAPT_MAX. */
const ADAPT_EXP = 0.69;
const ADAPT_MAX = 30;

const VS = `
attribute vec2 p;
varying vec2 uv;
void main(){ uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.0,1.0); }`;

const FS = `
precision highp float;
varying vec2 uv;
uniform sampler2D uBase;
uniform sampler2D uL0; uniform sampler2D uL1; uniform sampler2D uL2; uniform sampler2D uL3;
uniform float uW0; uniform float uW1; uniform float uW2; uniform float uW3;
uniform float uExposure;
uniform float uBaseW;
uniform float uGrain;
uniform float uTime;
uniform vec2 uTexel;

vec3 dec(vec3 e){ vec3 y = min(pow(e, vec3(2.2)), vec3(0.996)); return y / (1.0 - y); }
// Light layers: the 8-bit encoding keeps only coarse steps in the bright glow and the top codes jump ~2x
// apart. Invisible at 100% (it all maps to white) but at 1% eye adaptation lifts those values into the
// midtones as blocky stairs. Cap the top codes and soften by one pixel (tent filter) to hide it.
// ponytail: a real fix is re-encoding from the EXRs with more precision (blender/encode_layers.py).
vec3 decL(vec3 e){ vec3 y = min(pow(e, vec3(2.2)), vec3(0.9)); return y / (1.0 - y); }
vec3 layer(sampler2D s){
  vec2 d = uTexel, f = vec2(uTexel.x, -uTexel.y);
  return 0.5 * decL(texture2D(s, uv).rgb)
       + 0.125 * (decL(texture2D(s, uv + d).rgb) + decL(texture2D(s, uv - d).rgb)
                + decL(texture2D(s, uv + f).rgb) + decL(texture2D(s, uv - f).rgb));
}

vec3 aces(vec3 x){ // Narkowicz ACES fit
  const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c){
  return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }

void main(){
  vec3 L = uBaseW * dec(texture2D(uBase, uv).rgb);
  if (uW0 > 0.0) L += uW0 * layer(uL0);
  if (uW1 > 0.0) L += uW1 * layer(uL1);
  if (uW2 > 0.0) L += uW2 * layer(uL2);
  if (uW3 > 0.0) L += uW3 * layer(uL3);
  vec3 c = toSRGB(aces(L * uExposure * 0.8));
  // sensor-like grain only when the eye/camera has "opened up" in a dark room
  c += (hash(uv * 1024.0) - 0.5) * uGrain;
  gl_FragColor = vec4(c, 1.0);
}`;

export class Compositor {
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private tex: WebGLTexture[] = [];
  private names: string[] = [];
  private meta: LayerMeta | null = null;
  private weights: number[] = [0, 0, 0, 0];
  private baseW = 0;
  private exposure = 1;
  private targetExposure = 1;
  private raf = 0;
  private last = 0;
  private uni: Record<string, WebGLUniformLocation | null> = {};
  ready = false;

  static supported(): boolean {
    try {
      return !!document.createElement('canvas').getContext('webgl');
    } catch {
      return false;
    }
  }

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL not available');
    this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    gl.useProgram(p);
    this.prog = p;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uBase', 'uL0', 'uL1', 'uL2', 'uL3', 'uW0', 'uW1', 'uW2', 'uW3', 'uExposure', 'uBaseW', 'uGrain', 'uTime', 'uTexel']) {
      this.uni[n] = gl.getUniformLocation(p, n);
    }
  }

  /** Load `base` plus up to four light layers from `${dir}/<name>.webp`. */
  async load(dir: string, layerNames: string[], meta: LayerMeta): Promise<void> {
    if (layerNames.length > MAX_LAYERS) throw new Error('too many layers');
    const gl = this.gl;
    this.ready = false;
    const imgs = await Promise.all(['base', ...layerNames].map((n) => loadImage(`${dir}/${n}.webp`)));
    this.tex.forEach((t) => gl.deleteTexture(t));
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    this.tex = imgs.map((img, i) => {
      const t = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    });
    // unused samplers point at the base texture
    ['uBase', 'uL0', 'uL1', 'uL2', 'uL3'].forEach((n, i) => gl.uniform1i(this.uni[n], i < this.tex.length ? i : 0));
    this.names = layerNames;
    this.meta = meta;
    this.baseW = (BASE_FRAC * this.fixtureRef()) / (meta.layers.base?.meanLum ?? 0.05);
    this.weights = [0, 0, 0, 0];
    this.canvas.width = meta.width;
    this.canvas.height = meta.height;
    gl.viewport(0, 0, meta.width, meta.height);
    gl.uniform2f(this.uni.uTexel, 1 / meta.width, 1 / meta.height);
    this.targetExposure = this.computeExposure();
    this.exposure = this.targetExposure;
    this.ready = true;
    this.draw(performance.now());
  }

  /** weights keyed by layer name (e.g. { recessed_6000: 0.5, recessed_3000: 0.5 }) */
  setWeights(w: Record<string, number>): void {
    this.weights = [0, 1, 2, 3].map((i) => Math.max(0, w[this.names[i]] ?? 0));
    this.targetExposure = this.computeExposure();
  }

  /** Jump straight to the adapted exposure (e.g. right after a scene loads). */
  snapExposure(): void {
    this.exposure = this.targetExposure;
  }

  /**
   * Eye adaptation: darker scene → open up. Tuned to what a person in the room sees, not to the photometric
   * ratio: at 1% the eye adapts enough that the room around is still faintly visible (mean L* ≈ 24 vs 50 at
   * 100%), while each step down still reads darker. Exponent 0.36 / cap 6 matched Stevens' cube-root law
   * exactly but looked near-black on a screen viewed in a lit room.
   */
  private computeExposure(): number {
    if (!this.meta) return 1;
    const L = this.meta.layers;
    const base = (L.base?.meanLum ?? 0.05) * this.baseW;
    const ref = base + this.fixtureRef();
    let cur = base;
    this.names.forEach((n, i) => (cur += this.weights[i] * (L[n]?.meanLum ?? 0)));
    // normalise "all on" to TARGET_LUM, then open up partially as the room gets darker
    const norm = Math.pow(TARGET_LUM / ref, 0.85);
    const adapt = Math.min(Math.max(Math.pow(ref / Math.max(cur, 1e-4), ADAPT_EXP), 1), ADAPT_MAX);
    return norm * adapt;
  }

  /** Mean luminance of every fixture group at full power, one colour channel each. */
  private fixtureRef(): number {
    const L = this.meta?.layers ?? {};
    let ref = 0;
    new Set(this.names.map((n) => n.replace(/_\d+$/, ''))).forEach((g) => {
      const k = this.names.find((n) => n.startsWith(g + '_'));
      if (k) ref += L[k]?.meanLum ?? 0;
    });
    return ref;
  }

  private normExposure(): number {
    if (!this.meta) return 1;
    const ref = (this.meta.layers.base?.meanLum ?? 0.05) * this.baseW + this.fixtureRef();
    return Math.pow(TARGET_LUM / ref, 0.85);
  }

  start(): void {
    const loop = (t: number) => {
      this.draw(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private draw(t: number): void {
    if (!this.ready) return;
    const dt = this.last ? Math.min((t - this.last) / 1000, 0.1) : 0;
    this.last = t;
    // adaptation: brightening is fast (pupil closes), darkening is slower
    const tau = this.targetExposure > this.exposure ? 0.9 : 0.25;
    this.exposure += (this.targetExposure - this.exposure) * (1 - Math.exp(-dt / tau));
    const gl = this.gl;
    gl.useProgram(this.prog);
    this.weights.forEach((w, i) => gl.uniform1f(this.uni[`uW${i}`], w));
    gl.uniform1f(this.uni.uExposure, this.exposure);
    gl.uniform1f(this.uni.uBaseW, this.baseW);
    gl.uniform1f(this.uni.uGrain, Math.min(Math.max((this.exposure / this.normExposure() - 1.4) * 0.012, 0), 0.03));
    gl.uniform1f(this.uni.uTime, (t / 1000) % 100);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy(): void {
    this.stop();
    this.tex.forEach((t) => this.gl.deleteTexture(t));
  }
}

/** Decoded layer images are cached, so switching back and forth between rooms is instant. */
const imageCache = new Map<string, Promise<HTMLImageElement>>();
const metaCache = new Map<string, Promise<LayerMeta>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => res(img);
      img.onerror = () => {
        imageCache.delete(src);
        rej(new Error(`failed to load ${src}`));
      };
      img.src = src;
    });
    imageCache.set(src, p);
  }
  return p;
}

export function loadMeta(dir: string): Promise<LayerMeta> {
  let p = metaCache.get(dir);
  if (!p) {
    p = fetch(`${dir}/layers.json`).then((r) => {
      if (!r.ok) throw new Error(`failed to load ${dir}/layers.json`);
      return r.json() as Promise<LayerMeta>;
    });
    p.catch(() => metaCache.delete(dir));
    metaCache.set(dir, p);
  }
  return p;
}

/** Warm the cache for a scene the visitor is likely to open next (errors are ignored). */
export function prefetch(dir: string, layerNames: string[]): void {
  loadMeta(dir).catch(() => undefined);
  for (const n of ['base', ...layerNames]) loadImage(`${dir}/${n}.webp`).catch(() => undefined);
}

/** Split a fixture's (level, kelvin) into weights for its 6000K and 3000K layers (mired-linear mix). */
export function colorWeights(level: number, kelvin: number): { w6000: number; w3000: number } {
  const m = 1e6 / kelvin;
  const m6 = 1e6 / 6000;
  const m3 = 1e6 / 3000;
  const t = Math.min(Math.max((m - m6) / (m3 - m6), 0), 1);
  return { w6000: level * (1 - t), w3000: level * t };
}
