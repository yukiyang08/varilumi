import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FUNCTIONS, QUICK_MS, kelvinLabel, type FunctionId } from './engine/functions';
import { SwitchEngine } from './engine/switchEngine';
import { colorWeights } from './render/compositor';
import { getSetup, powerText, type FixtureId, type RoomId } from './scenes';
import { SceneView } from './components/SceneView';
import { ControlPanel, pct, type GroupConfig } from './components/ControlPanel';
import { ProductCards, type ProductData } from './components/ProductCards';
import { TUT_STEPS, Tutorial } from './components/Tutorial';
import { MobileLayout } from './components/MobileLayout';
import { Wizard, type WizardStep } from './components/Wizard';
import { Breadcrumb } from './components/Breadcrumb';
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

type Step = WizardStep | 'try';

export default function App() {
  const [room, setRoom] = useState<RoomId>('living');
  const [fixture, setFixture] = useState<FixtureId>('recessed');
  const setup = useMemo(() => getSetup(room, fixture), [room, fixture]);
  const [step, setStep] = useState<Step>('room');
  const [single, setSingle] = useState(false); // editing one choice from the breadcrumb

  const [cfg, setCfg] = useState<GroupConfig>({ functionId: 'four-step', kelvin: setup.fixture.kelvin, memory: false });

  // one engine for the current room × fixture; a new setup is like installing new lamps, switched on
  const engine = useRef<SwitchEngine>(null as unknown as SwitchEngine);
  const engineKey = useRef('');
  if (engineKey.current !== setup.key) {
    engine.current = new SwitchEngine({ ...cfg });
    engine.current.press(performance.now());
    engineKey.current = setup.key;
  }

  const [productData, setProducts] = useState<ProductData | null>(null);
  const [tutStep, setTutStep] = useState<number | null>(() => (store.get(TUT_KEY) ? null : 0));
  const [presses, setPresses] = useState(0);
  const [busy, setBusy] = useState(false);

  // animation clock + LED soft-start smoothing + usage tracking
  const [now, setNow] = useState(() => performance.now());
  const shown = useRef<{ level: number; mired: number } | null>(null);
  const usage = useRef<Record<string, { ms: number; label: string; fn: string }>>({});
  const lastT = useRef(performance.now());

  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      const dt = Math.min((t - lastT.current) / 1000, 0.1);
      lastT.current = t;
      const e = engine.current;
      const s = e.state(t);
      const target = { level: s.level, mired: 1e6 / s.kelvin };
      const cur = (shown.current ??= { ...target });
      const tau = target.level > cur.level ? RISE_S : FALL_S;
      cur.level += (target.level - cur.level) * (1 - Math.exp(-dt / tau));
      // colour changes only while lit; snap when dark so the next turn-on starts at the right colour
      cur.mired = cur.level < 0.002 ? target.mired : cur.mired + (target.mired - cur.mired) * (1 - Math.exp(-dt / RISE_S));
      // usage: time spent at each setting (ignores ramps and darkness)
      if (s.switchOn && s.level > 0 && !s.ramping) {
        const def = FUNCTIONS[e.options.functionId];
        const label = `${kelvinLabel(s.kelvin)} ${pct(s.level)}%`;
        const key = `${engineKey.current}|${def.id}|${label}`;
        const u = (usage.current[key] ??= { ms: 0, label, fn: def.name });
        u.ms += dt * 1000;
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

  const press = useCallback(() => {
    const e = engine.current;
    const t = performance.now();
    e.press(t);
    const st = e.state(t);
    switchFeedback(st.switchOn);
    advanceTutorial(st.event);
    setPresses((n) => n + 1);
  }, [advanceTutorial]);

  /** ⚡快切 / 🐢慢切 buttons: flip the switch off, then on again after `gap` ms, exactly as a hand would. */
  const runSequence = useCallback(
    (gap: number) => {
      const st = engine.current.state(performance.now());
      setBusy(true);
      const done = () => {
        press();
        setBusy(false);
      };
      if (st.switchOn) {
        press();
        setTimeout(done, gap);
      } else {
        // already off: for 慢切 make sure the off time has passed the quick window
        const wait = gap >= QUICK_MS && st.offFor !== null && st.offFor < gap ? gap - st.offFor : 0;
        setTimeout(done, wait);
      }
    },
    [press],
  );
  const onQuick = () => runSequence(350);
  const onSlow = () => runSequence(QUICK_MS + 300);

  const configure = useCallback((patch: Partial<GroupConfig>) => {
    const e = engine.current;
    const t = performance.now();
    const fnChanged = patch.functionId !== undefined && patch.functionId !== e.options.functionId;
    const memChanged = patch.memory !== undefined && patch.memory !== e.options.memory;
    e.configure(patch, t);
    // a new function is like a freshly installed lamp: switch it on so the visitor sees it straight away
    if (fnChanged || memChanged) e.press(t);
    setCfg((c) => ({ ...c, ...patch }));
  }, []);

  // ---- picker flow
  const next = (from: WizardStep) => {
    if (single) {
      setSingle(false);
      setStep('try');
      return;
    }
    setStep(from === 'room' ? 'fixture' : from === 'fixture' ? 'need' : 'try');
  };
  const pickRoom = (r: RoomId) => {
    setRoom(r);
    next('room');
  };
  const pickFixture = (f: FixtureId) => {
    setFixture(f);
    const k = getSetup(room, f).fixture.kelvin;
    setCfg((c) => ({ ...c, kelvin: k }));
    engineKey.current = ''; // rebuild the engine with the fixture's default colour
    next('fixture');
  };
  const pickNeed = (fn: FunctionId) => {
    configure({ functionId: fn });
    next('need');
  };
  const editStep = (s: WizardStep) => {
    setSingle(true);
    setStep(s);
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    if (single || step === 'room') {
      setSingle(false);
      setStep('try');
    } else setStep(step === 'need' ? 'fixture' : 'room');
  };

  // ---- derived view state
  const state = engine.current.state(now);
  const sh = shown.current ?? { level: state.level, mired: 1e6 / state.kelvin };
  const weightKey = `${setup.key}:${sh.level.toFixed(4)}:${sh.mired.toFixed(1)}`;
  const weights = useMemo(() => {
    const { w6000, w3000 } = colorWeights(sh.level, 1e6 / sh.mired);
    return { [setup.layers[0]]: w6000, [setup.layers[1]]: w3000 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightKey]);
  const power = powerText(setup, state.level);
  const isMobile = useIsMobile();

  // recommendation once the visitor has played a little
  const favorite: Favorite | null = useMemo(() => {
    if (presses < 4) return null;
    const mine = Object.entries(usage.current).filter(([k]) => k.startsWith(`${setup.key}|${cfg.functionId}|`));
    if (!mine.length) return null;
    const [, best] = mine.sort((a, b) => b[1].ms - a[1].ms)[0];
    return best.ms > 3000 ? { label: best.label, functionName: best.fn, seconds: Math.round(best.ms / 1000) } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presses, setup.key, cfg.functionId, Math.floor(now / 2000)]);

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

  const header = (compact: boolean) => (
    <header className={`top ${compact ? 'm-top' : ''}`}>
      <a className="brand" href="https://www.varilumi.com/" target="_blank" rel="noopener">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="飛利明 Varilumi" width={compact ? 34 : 44} height={compact ? 34 : 44} />
        <span>
          <b>開關調光體驗室</b>
          <small>{compact ? '不用換開關，按一下就能調光調色' : '飛利明 VariLumi'}</small>
        </span>
      </a>
      {step === 'try' && (
        <button type="button" className="link help" onClick={() => setTutStep(0)}>
          ？教學
        </button>
      )}
    </header>
  );

  const crumbs = <Breadcrumb setup={setup} functionId={cfg.functionId} onEdit={editStep} />;
  const products = (
    <ProductCards data={productData} fixture={fixture} fixtureName={setup.fixture.name} functionId={cfg.functionId} favorite={favorite} />
  );
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

  if (step !== 'try') {
    return (
      <div className={`app ${isMobile ? 'is-mobile' : ''} wizard-page`}>
        {header(isMobile)}
        {!isMobile && step === 'room' && !single && (
          <div className="hero">
            <h1>
              不用換開關，<span className="grad">按一下就能調光調色</span>
            </h1>
            <p>選一個空間和燈具，親手按按看飛利明的開關調光。</p>
          </div>
        )}
        <Wizard
          step={step}
          room={room}
          fixture={fixture}
          functionId={cfg.functionId}
          single={single}
          onRoom={pickRoom}
          onFixture={pickFixture}
          onNeed={pickNeed}
          onBack={back}
          onSkip={() => setStep('try')}
        />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="app is-mobile">
        {header(true)}
        <MobileLayout
          setup={setup}
          state={state}
          power={power}
          cfg={cfg}
          weights={weights}
          onConfig={configure}
          onPress={press}
          onQuick={onQuick}
          onSlow={onSlow}
          busy={busy}
          crumbs={crumbs}
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
      {header(false)}
      {crumbs}
      <main className="layout">
        <div className="stage">
          <SceneView setup={setup} weights={weights} />
          <p className="disclaimer">3D 模擬畫面：{setup.detail}。實際光色與亮度依空間而異。</p>
        </div>
        <div className="side">
          <ControlPanel
            setup={setup}
            cfg={cfg}
            state={state}
            power={power}
            onConfig={configure}
            onPress={press}
            onQuick={onQuick}
            onSlow={onSlow}
            busy={busy}
            tutorial={tut ? <Tutorial step={tut.step} onSkip={tut.onSkip} onClose={tut.onClose} /> : null}
          />
        </div>
      </main>
      {products}
      {footer}
    </div>
  );
}
