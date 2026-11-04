import { useEffect, useRef, useState } from 'react';
import { Compositor, type LayerMeta } from '../render/compositor';
import { layerNames, type SceneDef } from '../scenes';

interface Props {
  scene: SceneDef;
  weights: Record<string, number>;
}

const BASE = `${import.meta.env.BASE_URL}renders`;

export function SceneView({ scene, weights }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compRef = useRef<Compositor | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'nogl'>('loading');
  const [meta, setMeta] = useState<LayerMeta | null>(null);

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
    setStatus((s) => (s === 'nogl' ? s : 'loading'));
    (async () => {
      try {
        const m: LayerMeta = await (await fetch(`${BASE}/${scene.id}/layers.json`)).json();
        if (cancelled) return;
        setMeta(m);
        if (compRef.current) {
          await compRef.current.load(`${BASE}/${scene.id}`, layerNames(scene), m);
          if (!cancelled) setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scene]);

  useEffect(() => {
    compRef.current?.setWeights(weights);
  }, [weights]);

  const ratio = meta ? `${meta.width} / ${meta.height}` : '3 / 2';
  return (
    <div className="scene" style={{ aspectRatio: ratio }}>
      <canvas ref={canvasRef} className="scene-canvas" aria-label={`${scene.name}燈光模擬畫面`} role="img" />
      {status === 'loading' && <div className="scene-msg">載入場景中…</div>}
      {status === 'error' && <div className="scene-msg">場景載入失敗，請重新整理</div>}
      {status === 'nogl' && <div className="scene-msg">你的瀏覽器不支援 WebGL，無法顯示光影模擬</div>}
    </div>
  );
}
