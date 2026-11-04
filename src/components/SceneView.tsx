import { useEffect, useRef, useState } from 'react';
import { Compositor, loadMeta, prefetch, type LayerMeta } from '../render/compositor';
import { ALL_SETUPS, type Setup } from '../scenes';

interface Props {
  setup: Setup;
  weights: Record<string, number>;
}

const BASE = `${import.meta.env.BASE_URL}renders`;
const FADE_MS = 380;

/**
 * The lit room. When the visitor switches room or fixture, the previous picture stays on screen
 * until the new one is ready and then cross-fades into it, so nothing flashes or jumps.
 */
export function SceneView({ setup, weights }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compRef = useRef<Compositor | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'nogl'>('loading');
  const [meta, setMeta] = useState<LayerMeta | null>(null);
  const [fade, setFade] = useState<{ src: string; out: boolean } | null>(null);
  const weightsRef = useRef(weights);
  weightsRef.current = weights;
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (!Compositor.supported()) {
      setStatus('nogl');
      return;
    }
    const c = new Compositor(canvasRef.current);
    compRef.current = c;
    c.start();
    return () => {
      c.destroy();
      compRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // freeze the current picture on top while the next scene loads
    if (loadedOnce.current && canvasRef.current) {
      try {
        setFade({ src: canvasRef.current.toDataURL('image/jpeg', 0.85), out: false });
      } catch {
        /* snapshot not available: just switch */
      }
    } else {
      setStatus((s) => (s === 'nogl' ? s : 'loading'));
    }
    (async () => {
      try {
        const dir = `${BASE}/${setup.dir}`;
        const m = await loadMeta(dir);
        if (cancelled) return;
        if (compRef.current) {
          await compRef.current.load(dir, setup.layers, m);
          if (cancelled) return;
          compRef.current.setWeights(weightsRef.current); // apply the current lights once images are in
          compRef.current.snapExposure();
        }
        setMeta(m);
        setStatus('ready');
        loadedOnce.current = true;
        setFade((f) => (f ? { ...f, out: true } : f));
        setTimeout(() => !cancelled && setFade(null), FADE_MS + 50);
      } catch {
        if (!cancelled) {
          setStatus('error');
          setFade(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setup]);

  // quietly preload what the visitor is likely to try next: other fixtures in this room, this fixture elsewhere
  useEffect(() => {
    const t = setTimeout(() => {
      for (const s of ALL_SETUPS) {
        if (s.key !== setup.key && (s.room.id === setup.room.id || s.fixture.id === setup.fixture.id)) {
          prefetch(`${BASE}/${s.dir}`, s.layers);
        }
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [setup]);

  useEffect(() => {
    compRef.current?.setWeights(weights);
  }, [weights]);

  const ratio = meta ? `${meta.width} / ${meta.height}` : '3 / 2';
  return (
    <div className="scene" style={{ aspectRatio: ratio }}>
      <canvas ref={canvasRef} className="scene-canvas" aria-label={`${setup.room.name}${setup.fixture.name}燈光模擬畫面`} role="img" />
      {fade && <img className={`scene-fade ${fade.out ? 'out' : ''}`} src={fade.src} alt="" aria-hidden="true" />}
      {status === 'loading' && !fade && <div className="scene-msg">載入場景中…</div>}
      {status === 'error' && <div className="scene-msg">場景載入失敗，請重新整理</div>}
      {status === 'nogl' && <div className="scene-msg">你的瀏覽器不支援 WebGL，無法顯示光影模擬</div>}
    </div>
  );
}
