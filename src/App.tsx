import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FUNCTIONS, kelvinLabel } from './engine/functions';
import { SwitchEngine, type LightState } from './engine/switchEngine';
import { colorWeights } from './render/compositor';
import { SCENES, powerText, type FixtureId, type LightGroupDef, type SceneDef } from './scenes';
import { SceneView } from './components/SceneView';
import { ControlPanel, pct, type GroupConfig } from './components/ControlPanel';
import { ProductCards, type ProductData } from './components/ProductCards';
import { TUT_STEPS, Tutorial } from './components/Tutorial';
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

/** What the visitor would actually see: LED drivers soft-start (~0.1 s) and fade out a touch faster. */
const RISE_S = 0.09;
const FALL_S = 0.06;

export interface Favorite {
  label: string;
  functionName: string;
  seconds: number;
}

export default function App() {
  const [sceneId, setSceneId] = useState<SceneDef['id']>('living');
  const scene = SCENES.find((s) => s.id === sceneId)!;
  const [groupId, setGroupId] = useState<FixtureId>(scene.groups[0].id);
  const group = scene.groups.find((g) => g.id === groupId) ?? scene.groups[0];

  // one engine per light group; every light starts ON so the first view is a lit room
  const engines = useRef<Record<string, SwitchEngine>>({});
  if (!Object.keys(engines.current).length) {
    const t = performance.now();
    for (const g of ALL_GROUPS) {
      const e = new SwitchEngine({ ...g.defaults });
      e.press(t);
      engines.current[g.id] = e;
    }
  }
  const [cfgs, setCfgs] = useState<Record<string, GroupConfig>>(() =>
    Object.fromEntries(ALL_GROUPS.map((g) => [g.id, { ...g.defaults }])),
  );
  const [productData, setProducts] = useState<ProductData | null>(null);
  const [tutStep, setTutStep] = useState<number | null>(() => (store.get(TUT_KEY) ? null : 0));
  const [presses, setPresses] = useState(0);

  // animation clock + LED soft-start smoothing + usage tracking
  const [now, setNow] = useState(() => performance.now());
  const shown = useRef<Record<string, { level: number; mired: number }>>({});
  const usage = useRef<Record<string, { ms: number; label: string; fn: string }>>({});
  const lastT = useRef(performance.now());
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const groupRef = useRef(group);
  groupRef.current = group;

  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      const dt = Math.min((t - lastT.current) / 1000, 0.1);
      lastT.current = t;
      for (const g of sceneRef.current.groups) {
        const s = engines.current[g.id].state(t);
        const target = { level: s.level, mired: 1e6 / s.kelvin };
        const cur = (shown.current[g.id] ??= { ...target });
        const tau = target.level > cur.level ? RISE_S : FALL_S;
        cur.level += (target.level - cur.level) * (1 - Math.exp(-dt / tau));
        // colour changes only while lit; snap when dark so the next turn-on starts at the right colour
        cur.mired = cur.level < 0.002 ? target.mired : cur.mired + (target.mired - cur.mired) * (1 - Math.exp(-dt / RISE_S));
        // usage: time spent at each setting of the group being controlled (ignores ramps and darkness)
        if (g.id === groupRef.current.id && s.switchOn && s.level > 0 && !s.ramping) {
          const def = FUNCTIONS[engines.current[g.id].options.functionId];
          const label = `${kelvinLabel(s.kelvin)} ${pct(s.level)}%`;
          const key = `${g.id}|${def.id}|${label}`;
          const u = (usage.current[key] ??= { ms: 0, label, fn: def.name });
          u.ms += dt * 1000;
        }
      }
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
      if (s === null || s >= TUT_STEPS.length) return s;
      if (s === 0 && (ev === 'step' || ev === 'ramp-start' || ev === 'ramp-stop')) return 1;
      if (s === 1 && (ev === 'slow-default' || ev === 'slow-memory')) {
        store.set(TUT_KEY, '1');
        return 2;
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
      setPresses((n) => n + 1);
    },
    [advanceTutorial],
  );

  const configure = useCallback((id: string, patch: Partial<GroupConfig>) => {
    const e = engines.current[id];
    const t = performance.now();
    const fnChanged = patch.functionId !== undefined && patch.functionId !== e.options.functionId;
    const memChanged = patch.memory !== undefined && patch.memory !== e.options.memory;
    e.configure(patch, t);
    // a new function is like a freshly installed lamp: switch it on so the visitor sees it straight away
    if (fnChanged || memChanged) e.press(t);
    setCfgs((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  }, []);

  const states: Record<string, LightState> = Object.fromEntries(scene.groups.map((g) => [g.id, engines.current[g.id].state(now)]));

  // light-layer weights from the smoothed (what-the-eye-sees) levels
  const weightKey = scene.groups.map((g) => `${shown.current[g.id]?.level.toFixed(4)}:${shown.current[g.id]?.mired.toFixed(1)}`).join('|');
  const weights = useMemo(() => {
    const w: Record<string, number> = {};
    for (const g of scene.groups) {
      const sh = shown.current[g.id] ?? { level: states[g.id].level, mired: 1e6 / states[g.id].kelvin };
      const { w6000, w3000 } = colorWeights(sh.level, 1e6 / sh.mired);
      w[`${g.id}_6000`] = w6000;
      w[`${g.id}_3000`] = w3000;
    }
    return w;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightKey, sceneId]);

  const cfg = cfgs[group.id];
  const state = states[group.id];
  const power = powerText(group, state.level);
  const isMobile = useIsMobile();

  // recommendation once the visitor has played a little
  const favorite: Favorite | null = useMemo(() => {
    if (presses < 4) return null;
    const mine = Object.entries(usage.current).filter(([k]) => k.startsWith(`${group.id}|${cfg.functionId}|`));
    if (!mine.length) return null;
    const [, best] = mine.sort((a, b) => b[1].ms - a[1].ms)[0];
    return best.ms > 3000 ? { label: best.label, functionName: best.fn, seconds: Math.round(best.ms / 1000) } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presses, group.id, cfg.functionId, Math.floor(now / 2000)]);

  const advancedGroups = scene.groups.filter((g) => g.advanced);
  const fixtureSwitch = (g: LightGroupDef) => (
    <button
      key={g.id}
      type="button"
      role="tab"
      aria-selected={g.id === group.id}
      className={g.id === group.id ? 'active' : ''}
      onClick={() => setGroupId(g.id)}
    >
      <span className={`lamp ${states[g.id].switchOn && states[g.id].level > 0 ? 'on' : ''}`} aria-hidden="true" />
      {g.name}
      <small>{g.detail}</small>
    </button>
  );
  const fixtures = advancedGroups.length ? (
    <div className="fixture-pick">
      <span className="opt-label">要控制哪一組燈？（每組燈有自己的開關）</span>
      <div className="group-tabs" role="tablist" aria-label="燈具">
        {scene.groups.map(fixtureSwitch)}
      </div>
    </div>
  ) : null;

  const tut =
    tutStep === null
      ? null
      : {
          step: tutStep,
          onSkip: () => {
            store.set(TUT_KEY, '1');
            setTutStep(null);
          },
          onClose: () => setTutStep(null),
        };

  const products = <ProductCards data={productData} fixture={group.id} fixtureName={group.name} functionId={cfg.functionId} favorite={favorite} />;
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
          state={state}
          power={power}
          cfg={cfg}
          weights={weights}
          onConfig={(p) => configure(group.id, p)}
          onPress={() => press(group.id)}
          fixtures={fixtures}
          tut={tut}
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
        <p>選一個功能，連按兩下牆上的開關，看看燈光怎麼變。</p>
      </div>

      <nav className="scene-tabs" aria-label="場景">
        {SCENES.map((s) => (
          <button key={s.id} type="button" className={s.id === sceneId ? 'active' : ''} onClick={() => setSceneId(s.id)} aria-pressed={s.id === sceneId}>
            {s.name}
            <small>{s.groups.filter((g) => !g.advanced).map((g) => g.name).join('＋')}</small>
          </button>
        ))}
      </nav>

      <main className="layout">
        <div className="stage">
          <SceneView scene={scene} weights={weights} />
          <p className="disclaimer">3D 模擬畫面，實際光色與亮度依空間、燈具數量而異。</p>
        </div>

        <div className="side">
          <p className="single-group">
            正在控制：<b>{group.name}</b>　{group.detail}
          </p>
          <ControlPanel
            group={group}
            cfg={cfg}
            state={state}
            power={power}
            onConfig={(p) => configure(group.id, p)}
            onPress={() => press(group.id)}
            tutorial={tut ? <Tutorial step={tut.step} onSkip={tut.onSkip} onClose={tut.onClose} /> : null}
            fixtures={fixtures}
          />
        </div>
      </main>

      {products}
      {footer}
    </div>
  );
}
