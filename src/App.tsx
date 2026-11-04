import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QUICK_MS } from './engine/functions';
import { SwitchEngine } from './engine/switchEngine';
import { colorWeights } from './render/compositor';
import { SCENES, type FixtureId, type SceneDef } from './scenes';
import { SceneView } from './components/SceneView';
import { ControlPanel, type GroupConfig } from './components/ControlPanel';
import { ProductCards, type ProductData } from './components/ProductCards';
import { Tutorial } from './components/Tutorial';
import { MobileLayout } from './components/MobileLayout';
import { switchFeedback } from './feedback';

const TUT_KEY = 'varilumi-tutorial-done';
const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  },
};

const ALL_GROUPS = SCENES.flatMap((s) => s.groups);
const MOBILE_QUERY = '(max-width: 959px) and (orientation: portrait)';

function useIsMobile() {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = matchMedia(MOBILE_QUERY);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

export default function App() {
  const [sceneId, setSceneId] = useState<SceneDef['id']>('living');
  const scene = SCENES.find((s) => s.id === sceneId)!;
  const [groupId, setGroupId] = useState<FixtureId>(scene.groups[0].id);
  const group = scene.groups.find((g) => g.id === groupId) ?? scene.groups[0];

  const engines = useRef<Record<string, SwitchEngine>>({});
  if (!Object.keys(engines.current).length) {
    for (const g of ALL_GROUPS) engines.current[g.id] = new SwitchEngine({ ...g.defaults });
  }
  const [cfgs, setCfgs] = useState<Record<string, GroupConfig>>(() =>
    Object.fromEntries(ALL_GROUPS.map((g) => [g.id, { ...g.defaults }])),
  );
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [productData, setProducts] = useState<ProductData | null>(null);
  const [tutStep, setTutStep] = useState<number | null>(() => (store.get(TUT_KEY) ? null : 0));

  // animation clock
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      setNow(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/products.json`)
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => setProducts(null));
  }, []);

  useEffect(() => {
    if (!scene.groups.some((g) => g.id === groupId)) setGroupId(scene.groups[0].id);
  }, [scene, groupId]);

  const advanceTutorial = useCallback((ev: string | null) => {
    setTutStep((s) => {
      if (s === null || s >= 3) return s;
      if (s === 0 && ev !== 'off' && ev !== null) return 1;
      if (s === 1 && (ev === 'step' || ev === 'ramp-start' || ev === 'ramp-stop')) return 2;
      if (s === 2 && (ev === 'slow-default' || ev === 'slow-memory')) {
        store.set(TUT_KEY, '1');
        return 3;
      }
      return s;
    });
  }, []);

  const press = useCallback(
    (id: string) => {
      const e = engines.current[id];
      const t = performance.now();
      e.press(t);
      const st = e.state(t);
      switchFeedback(st.switchOn);
      advanceTutorial(st.event);
    },
    [advanceTutorial],
  );

  const runSequence = useCallback(
    (id: string, gap: number) => {
      const e = engines.current[id];
      const t = performance.now();
      if (!e.state(t).switchOn) {
        // already off: open now (or after the slow window has passed)
        const off = e.state(t).offFor;
        const wait = gap >= QUICK_MS && off !== null && off < gap ? gap - off : 0;
        if (!wait) return press(id);
        setBusy((b) => ({ ...b, [id]: true }));
        setTimeout(() => {
          press(id);
          setBusy((b) => ({ ...b, [id]: false }));
        }, wait);
        return;
      }
      press(id);
      setBusy((b) => ({ ...b, [id]: true }));
      setTimeout(() => {
        press(id);
        setBusy((b) => ({ ...b, [id]: false }));
      }, gap);
    },
    [press],
  );

  const configure = useCallback((id: string, patch: Partial<GroupConfig>) => {
    engines.current[id].configure(patch, performance.now());
    setCfgs((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  }, []);

  // light-layer weights for the current scene
  const states = Object.fromEntries(scene.groups.map((g) => [g.id, engines.current[g.id].state(now)]));
  const weightKey = scene.groups.map((g) => `${states[g.id].level.toFixed(4)}:${states[g.id].kelvin}`).join('|');
  const weights = useMemo(() => {
    const w: Record<string, number> = {};
    for (const g of scene.groups) {
      const s = states[g.id];
      const { w6000, w3000 } = colorWeights(s.level, s.kelvin);
      w[`${g.id}_6000`] = w6000;
      w[`${g.id}_3000`] = w3000;
    }
    return w;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightKey, sceneId]);

  const cfg = cfgs[group.id];
  const state = states[group.id];
  const isMobile = useIsMobile();

  const tutorial =
    tutStep !== null ? (
      <Tutorial
        step={tutStep}
        onSkip={() => {
          store.set(TUT_KEY, '1');
          setTutStep(null);
        }}
        onClose={() => setTutStep(null)}
      />
    ) : null;

  const products = <ProductCards data={productData} fixture={group.id} fixtureName={group.name} functionId={cfg.functionId} />;
  const footer = (
    <footer className="foot">
      <p>
        想了解更多功能（兩色一調光、四色燈、客製分區點燈…）請看
        <a href="https://www.varilumi.com/function-selection-guide/" target="_blank" rel="noopener">
          開關調光燈選購攻略
        </a>
        ，或洽飛利明 LINE 客服。
      </p>
      <p className="copy">© 飛利明 VariLumi・台灣設計製造・開關調光技術多國專利</p>
    </footer>
  );

  if (isMobile) {
    return (
      <div className="app is-mobile">
        <header className="top m-top">
          <a className="brand" href="https://www.varilumi.com/" target="_blank" rel="noopener">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="飛利明 Varilumi" width="34" height="34" />
            <span>
              <b>開關調光體驗室</b>
              <small>不用換開關，按一下就能調光調色</small>
            </span>
          </a>
          <button type="button" className="link help" onClick={() => setTutStep(0)}>
            ？教學
          </button>
        </header>
        <MobileLayout
          scene={scene}
          onScene={setSceneId}
          group={group}
          onGroup={setGroupId}
          states={states}
          cfg={cfg}
          busy={!!busy[group.id]}
          weights={weights}
          onConfig={(p) => configure(group.id, p)}
          onPress={() => press(group.id)}
          onQuick={() => runSequence(group.id, 350)}
          onSlow={() => runSequence(group.id, QUICK_MS + 300)}
          tut={
            tutStep === null
              ? null
              : {
                  step: tutStep,
                  onSkip: () => {
                    store.set(TUT_KEY, '1');
                    setTutStep(null);
                  },
                  onClose: () => setTutStep(null),
                }
          }
          after={
            <>
              {products}
              {footer}
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="https://www.varilumi.com/" target="_blank" rel="noopener">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="飛利明 Varilumi" width="44" height="44" />
          <span>
            <b>開關調光體驗室</b>
            <small>飛利明 VariLumi</small>
          </span>
        </a>
        <button type="button" className="link help" onClick={() => setTutStep(0)}>
          ？教學
        </button>
      </header>

      <div className="hero">
        <h1>
          不用換開關，<span className="grad">按一下就能調光調色</span>
        </h1>
        <p>選一個功能，按下牆上的開關，看看燈光怎麼變。</p>
      </div>

      <nav className="scene-tabs" aria-label="場景">
        {SCENES.map((s) => (
          <button key={s.id} type="button" className={s.id === sceneId ? 'active' : ''} onClick={() => setSceneId(s.id)} aria-pressed={s.id === sceneId}>
            {s.name}
            <small>{s.groups.map((g) => g.name).join('＋')}</small>
          </button>
        ))}
      </nav>

      <main className="layout">
        <div className="stage">
          <SceneView scene={scene} weights={weights} />
          <p className="disclaimer">3D 模擬畫面，實際光色與亮度依空間、燈具數量而異。</p>
        </div>

        <div className="side">
          {scene.groups.length > 1 && (
            <div className="group-tabs" role="tablist" aria-label="燈具">
              {scene.groups.map((g) => {
                const s = states[g.id];
                return (
                  <button key={g.id} type="button" role="tab" aria-selected={g.id === group.id} className={g.id === group.id ? 'active' : ''} onClick={() => setGroupId(g.id)}>
                    <span className={`lamp ${s.switchOn && s.level > 0 ? 'on' : ''}`} aria-hidden="true" />
                    {g.name}
                    <small>{g.detail}</small>
                  </button>
                );
              })}
            </div>
          )}
          {scene.groups.length === 1 && (
            <p className="single-group">
              <b>{group.name}</b>　{group.detail}
            </p>
          )}
          <ControlPanel
            group={group}
            cfg={cfg}
            state={state}
            busy={!!busy[group.id]}
            onConfig={(p) => configure(group.id, p)}
            onPress={() => press(group.id)}
            onQuick={() => runSequence(group.id, 350)}
            onSlow={() => runSequence(group.id, QUICK_MS + 300)}
            tutorial={tutorial}
          />
        </div>
      </main>

      {products}
      {footer}
    </div>
  );
}
