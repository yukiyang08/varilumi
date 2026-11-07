import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FUNCTIONS, FUNCTION_ORDER, QUICK_MS, SLOW_GAP_MS, type FunctionId } from './engine/functions';
import { SwitchEngine, type EngineEvent } from './engine/switchEngine';
import { colorWeights } from './render/compositor';
import { FIXTURES, ROOMS, getSetup, powerText, type FixtureId, type RoomId } from './scenes';
import { SceneView } from './components/SceneView';
import { ColorPick, ControlPanel, MemoryToggle, PictureStatus, eventText, stateLabel, type GroupConfig } from './components/ControlPanel';
import { ProductCards, type ProductData } from './components/ProductCards';
import { CoachCard, DEMOS, TIPS, memoryDemo, tutSteps, type DemoAction, TUT_DONE, type CoachTarget, type TipId } from './components/Tutorial';
import { MobileLayout } from './components/MobileLayout';
import { Breadcrumb, SceneTabs, type PickKind } from './components/Breadcrumb';
import type { FingerTap } from './components/WallSwitch';
import { DemoCaption, SceneToast, type Toast } from './components/SceneToast';
import { QuickPicker } from './components/QuickPicker';
import { Spotlight } from './components/Spotlight';
import { TutorialAsk } from './components/TutorialAsk';
import { switchFeedback, unlockAudio } from './feedback';
import { track } from './track';

const TUT_KEY = 'varilumi-tutorial-done';
const TIPS_KEY = 'varilumi-tips-seen';
/** lit areas during the tutorial: the picture (to see the result), the coach card, the button to press and the wall switch (pressing it works too) */
const SPOT_TARGETS = ['.picture, .m-picture', '.coach', '.tw-frame'];
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

/**
 * Where the visitor starts. A link can open a given setup, e.g. ?room=bedroom&fixture=cove&fn=stepless
 * (the product pages on varilumi.com can deep-link straight to their fixture); anything unknown falls back.
 */
function startFromUrl() {
  const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const pick = <T extends string>(v: string | null, ok: readonly T[], fallback: T): T => (v && (ok as readonly string[]).includes(v) ? (v as T) : fallback);
  return {
    room: pick(q.get('room'), ROOMS.map((r) => r.id), 'living'),
    fixture: pick(q.get('fixture'), FIXTURES.map((f) => f.id), 'recessed'),
    fn: pick(q.get('fn'), FUNCTION_ORDER, 'four-step'),
  };
}
const START = startFromUrl();

export default function App() {
  const [room, setRoom] = useState<RoomId>(START.room);
  const [fixture, setFixture] = useState<FixtureId>(START.fixture);
  const setup = useMemo(() => getSetup(room, fixture), [room, fixture]);
  const [sheet, setSheet] = useState<PickKind | null>(null); // in-place picker opened from the breadcrumb

  const [cfg, setCfg] = useState<GroupConfig>({ functionId: START.fn, kelvin: setup.fixture.kelvin, memory: false });

  // one engine for the current room × fixture; a new setup is like installing new lamps, switched on
  const engine = useRef<SwitchEngine>(null as unknown as SwitchEngine);
  const engineKey = useRef('');
  if (engineKey.current !== setup.key) {
    engine.current = new SwitchEngine({ ...cfg });
    engine.current.press(performance.now());
    engineKey.current = setup.key;
  }

  const [productData, setProducts] = useState<ProductData | null>(null);
  // first visit on this device: a welcome popup offers the 快切 / 慢切 lesson (start or skip)
  const [askTut, setAskTut] = useState(() => !store.get(TUT_KEY));
  const [tutStep, setTutStep] = useState<number | null>(null);
  const tutRef = useRef(tutStep);
  tutRef.current = tutStep;
  const [tip, setTip] = useState<TipId | null>(null);
  const tipRef = useRef(tip);
  tipRef.current = tip;
  const [busy, setBusy] = useState(false);
  const [finger, setFinger] = useState<FingerTap | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef(0);
  const wasFlashing = useRef(false);

  // animation clock + LED soft-start smoothing
  const [now, setNow] = useState(() => performance.now());
  const shown = useRef<{ level: number; mired: number } | null>(null);
  const lastT = useRef(performance.now());

  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      const dt = Math.min((t - lastT.current) / 1000, 0.1);
      lastT.current = t;
      const e = engine.current;
      const s = e.state(t);
      // 無段調光 with memory: when the ramp reaches 100% unstopped the lamp flashes = memorised at 100%
      if (s.flashing && !wasFlashing.current && e.options.memory) {
        setToast({ key: t, kind: 'flash', memory: true, label: '100%' });
        clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 3200);
      }
      wasFlashing.current = s.flashing;
      const target = { level: s.level, mired: 1e6 / s.kelvin };
      const cur = (shown.current ??= { ...target });
      const tau = target.level > cur.level ? RISE_S : FALL_S;
      cur.level += (target.level - cur.level) * (1 - Math.exp(-dt / tau));
      // colour changes only while lit; snap when dark so the next turn-on starts at the right colour
      cur.mired = cur.level < 0.002 ? target.mired : cur.mired + (target.mired - cur.mired) * (1 - Math.exp(-dt / RISE_S));
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

  const advanceTutorial = useCallback((ev: EngineEvent) => {
    setTutStep((s) => {
      const steps = tutSteps(engine.current.options.functionId);
      if (s === null || s >= steps.length || !ev || !steps[s].doneOn.includes(ev)) return s;
      if (s + 1 === steps.length) {
        store.set(TUT_KEY, '1');
        track('tutorial_complete');
      }
      return s + 1;
    });
  }, []);

  const press = useCallback(() => {
    const e = engine.current;
    const t = performance.now();
    e.press(t);
    const st = e.state(t);
    switchFeedback(st.switchOn);
    advanceTutorial(st.event);
    // first lesson: show what the 快切 did, right on the picture
    if (tutRef.current !== null && (st.event === 'step' || st.event === 'ramp-start')) {
      const label = st.event === 'step' ? stateLabel(e.options.functionId, st) : '從夜燈開始慢慢變亮';
      setToast({ key: t, kind: 'quick', memory: false, label });
      clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 2400);
    }
    const tp = tipRef.current;
    if (tp && st.event && TIPS[tp]?.doneOn.includes(st.event)) setTip(null);
    if (st.event === 'slow-memory' || st.event === 'slow-default') {
      const label = stateLabel(e.options.functionId, st);
      setToast({ key: t, kind: 'slow', memory: st.event === 'slow-memory', label });
      clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 3200);
    }
  }, [advanceTutorial]);

  /**
   * 快切 / 慢切 buttons: a hand flips the switch off, then on again after `gap` ms, exactly as a person
   * would. Each tap starts the finger animation and flips the switch when the fingertip touches the rocker.
   */
  const runSequence = useCallback(
    (gap: number): Promise<void> => {
      const TOUCH_MS = 250; // finger reaches the rocker ~250 ms into its 520 ms tap animation
      // resolves once the finger has actually flipped the switch (timers can run late on a busy page)
      const tap = (at: number) =>
        new Promise<void>((done) =>
          setTimeout(() => {
            const isOn = engine.current.state(performance.now()).switchOn;
            setFinger((f) => ({ n: (f?.n ?? 0) + 1, target: isOn ? 'bottom' : 'top' }));
            setTimeout(() => {
              press();
              done();
            }, TOUCH_MS);
          }, at),
        );
      unlockAudio(); // still inside the click: lets the timed switch presses below make their sound
      const st = engine.current.state(performance.now());
      setBusy(true);
      let taps: Promise<void>[];
      if (st.switchOn) {
        taps = [tap(0), tap(gap)]; // off, then on again `gap` ms after the first touch
      } else {
        // already off: for 慢切 make sure the off time has passed before switching back on
        const wait = gap >= QUICK_MS && st.offFor !== null && st.offFor < gap ? gap - st.offFor : 0;
        taps = [tap(Math.max(wait - TOUCH_MS, 0))];
      }
      return Promise.all(taps).then(() => {
        setBusy(false);
        setTimeout(() => setFinger(null), 600);
        return new Promise<void>((r) => setTimeout(r, 100));
      });
    },
    [press],
  );

  // ---- animated demo of the current function: the hand presses the switch, each press is captioned
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const demoRef = useRef(0);
  const [demo, setDemo] = useState<string | null>(null);
  const stopDemo = useCallback(() => {
    demoRef.current++;
    setDemo(null);
  }, []);
  /**
   * Plays `script` (default: the current function's demo). The lamp starts freshly switched on at its default;
   * a 記憶功能 demo starts with memory off and the visitor's own setting is put back afterwards.
   */
  const runDemo = useCallback(
    async (script?: DemoAction[], after?: () => void) => {
      const id = ++demoRef.current;
      const alive = () => demoRef.current === id;
      const fn = engine.current.options.functionId;
      const steps = script ?? DEMOS[fn];
      const memBefore = cfgRef.current.memory;
      const memDemo = steps.includes('mem-on');
      unlockAudio();
      setTip(null);
      setTutStep(null);
      if (memDemo && memBefore) configure({ memory: false });
      engine.current = new SwitchEngine({ ...engine.current.options, memory: memDemo ? false : memBefore });
      engine.current.press(performance.now());
      const say = () => setDemo(eventText(engine.current.state(performance.now()), cfgRef.current));
      say();
      for (const a of steps) {
        if (!alive()) break;
        if (typeof a === 'number') await new Promise((r) => setTimeout(r, a));
        else if (a === 'mem-on') {
          configure({ memory: true });
          setDemo('打開記憶功能（右上角）：再做一次看看');
        } else {
          await runSequence(a === 'quick' ? 350 : SLOW_GAP_MS);
          if (alive()) say();
        }
      }
      if (memDemo && cfgRef.current.memory !== memBefore) configure({ memory: memBefore });
      if (!alive()) return;
      setDemo(null);
      if (after) after();
      else if (TIPS[fn]) setTip(fn); // your turn now
    },
    // configure is stable (useCallback with no deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runSequence],
  );

  // the visitor's own presses take over from a running demo
  const userPress = useCallback(() => {
    stopDemo();
    press();
  }, [stopDemo, press]);
  const onQuick = () => {
    stopDemo();
    void runSequence(350);
  };
  const onSlow = () => {
    stopDemo();
    void runSequence(SLOW_GAP_MS);
  };
  useEffect(() => stopDemo(), [setup.key, stopDemo]);
  useEffect(() => {
    track('scene_view', { room, fixture });
  }, [room, fixture]);
  useEffect(() => {
    track('function_view', { function: cfg.functionId });
  }, [cfg.functionId]);

  const configure = useCallback((patch: Partial<GroupConfig>) => {
    const e = engine.current;
    const t = performance.now();
    const fnChanged = patch.functionId !== undefined && patch.functionId !== e.options.functionId;
    e.configure(patch, t);
    // a new function is like a freshly installed lamp: switch it on so the visitor sees it straight away
    if (fnChanged) e.press(t);
    setCfg((c) => ({ ...c, ...patch }));
  }, []);

  // ---- room / fixture / function pickers
  const editStep = (s: PickKind) => setSheet(s);
  // in-place changes from the simulator: apply immediately, keep the page where it is
  const quickRoom = (r: RoomId) => {
    setRoom(r);
    setSheet(null);
  };
  const quickFixture = (f: FixtureId) => {
    if (f !== fixture) {
      setFixture(f);
      setCfg((c) => ({ ...c, kelvin: getSetup(room, f).fixture.kelvin }));
      engineKey.current = '';
    }
    setSheet(null);
  };
  const quickNeed = (fn: FunctionId) => {
    configure({ functionId: fn });
    setSheet(null);
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

  const lesson = tutSteps(cfg.functionId);
  const learning = tutStep !== null && tutStep < lesson.length;

  // one-time tips: the first time a visitor meets a function, or turns 記憶功能 on
  useEffect(() => {
    if (learning || demo) return;
    let seen: string[] = [];
    try {
      seen = JSON.parse(store.get(TIPS_KEY) ?? '[]');
    } catch {
      /* ignore */
    }
    const id: TipId | null =
      cfg.memory && !seen.includes('memory') ? 'memory' : TIPS[cfg.functionId] && !seen.includes(cfg.functionId) ? cfg.functionId : null;
    if (!id) return;
    store.set(TIPS_KEY, JSON.stringify([...seen, id]));
    if (id === 'memory') {
      setTip(id);
      setTutStep(null); // the tip replaces the "學會了" card
      return;
    }
    const t = setTimeout(() => void runDemo(), 500);
    return () => clearTimeout(t);
  }, [learning, cfg.functionId, cfg.memory, runDemo, demo]);

  // end of the 快切 / 慢切 lesson: show 記憶功能 side by side, then the "學會了" card
  const memLesson = useRef(false);
  useEffect(() => {
    if (tutStep === 0) memLesson.current = false;
    if (tutStep !== lesson.length || memLesson.current) return;
    memLesson.current = true;
    const t = setTimeout(() => {
      store.set(TIPS_KEY, JSON.stringify([...new Set([...JSON.parse(store.get(TIPS_KEY) ?? '[]'), 'memory'])]));
      void runDemo(memoryDemo(engine.current.options.functionId), () => setTutStep(lesson.length));
    }, 900);
    return () => clearTimeout(t);
  }, [tutStep, runDemo]);
  // switching function ends its demo and its tip
  useEffect(() => {
    stopDemo();
    setTip((t) => (t && t !== 'memory' && t !== cfg.functionId ? null : t));
  }, [cfg.functionId, stopDemo]);

  const memDemo = () => void runDemo(memoryDemo(cfg.functionId), () => undefined);
  const askDialog = askTut ? (
    <TutorialAsk
      onYes={() => {
        track('tutorial_answer', { answer: 'yes' });
        setAskTut(false);
        setTutStep(0);
      }}
      onNo={() => {
        track('tutorial_answer', { answer: 'no' });
        store.set(TUT_KEY, '1');
        setAskTut(false);
      }}
    />
  ) : null;
  const demoCaption = demo ? <DemoCaption text={demo} onStop={stopDemo} /> : null;
  const spot = learning ? ['.tutorial', ...(lesson[tutStep!].targets ?? SPOT_TARGETS)] : [];
  // bring what the spotlight shows into view (the function list can be below the fold)
  useEffect(() => {
    if (!learning) return;
    const sel = lesson[tutStep!].targets?.[0];
    const el = sel ? document.querySelector(sel) : null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutStep, learning]);
  const coach: CoachTarget | null = learning ? lesson[tutStep!].coach ?? null : tip && !demo ? TIPS[tip]!.coach : null;
  const card = learning ? (
    <CoachCard
      intro={`${FUNCTIONS[cfg.functionId].plainName}・${FUNCTIONS[cfg.functionId].family}：${
        FUNCTIONS[cfg.functionId].family === '調光型' ? '只調亮度，光色固定' : '亮度和光色都能換'
      }`}
      text={lesson[tutStep!].title}
      onNext={lesson[tutStep!].targets ? () => setTutStep((s) => (s === null ? s : s + 1)) : undefined}
      dots={[tutStep!, lesson.length]}
      closeLabel="跳過教學"
      onClose={() => {
        track('tutorial_skip', { step: tutStep! + 1 });
        store.set(TUT_KEY, '1');
        setTutStep(null);
      }}
    />
  ) : tutStep !== null ? (
    <CoachCard text={TUT_DONE} done closeLabel="關閉" onClose={() => setTutStep(null)} />
  ) : tip ? (
    <CoachCard text={TIPS[tip]!.text} closeLabel="知道了" onClose={() => setTip(null)} />
  ) : null;

  const crumbs = (
    <div className="crumbs-wrap">
      <div className="crumbs-row">
        {isMobile ? (
          <Breadcrumb setup={setup} onEdit={editStep} />
        ) : (
          <SceneTabs room={room} fixture={fixture} onRoom={quickRoom} onFixture={quickFixture} />
        )}
        <button
          type="button"
          className="link help"
          onClick={() => {
            stopDemo();
            setTutStep(0);
          }}
        >
          ？教學
        </button>
      </div>
      {sheet && (
        <QuickPicker
          kind={sheet}
          room={room}
          fixture={fixture}
          functionId={cfg.functionId}
          onRoom={quickRoom}
          onFixture={quickFixture}
          onNeed={quickNeed}
          onClose={() => setSheet(null)}
          sheet={isMobile}
        />
      )}
    </div>
  );
  const products = (
    <ProductCards data={productData} fixture={fixture} fixtureName={setup.fixture.name} functionId={cfg.functionId} />
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

  if (isMobile) {
    return (
      <div className="app is-mobile">
        {learning && <Spotlight targets={spot} />}
        {askDialog}
        <MobileLayout
          setup={setup}
          state={state}
          power={power}
          cfg={cfg}
          weights={weights}
          onConfig={configure}
          onPress={userPress}
          onQuick={onQuick}
          onSlow={onSlow}
          onDemo={() => void runDemo()}
          demoing={!!demo}
          busy={busy}
          finger={finger}
          toast={toast}
          crumbs={crumbs}
          card={card}
          demoCaption={demoCaption}
          onMemDemo={memDemo}
          learning={learning}
          coach={coach}
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
      {learning && <Spotlight targets={spot} />}
      {askDialog}
      {crumbs}
      <main className="layout">
        <div className="stage">
          <div className="picture">
            <SceneView setup={setup} weights={weights} />
            {demoCaption ?? <SceneToast toast={toast} />}
            <MemoryToggle cfg={cfg} onConfig={configure} onDemo={memDemo} />
            <ColorPick cfg={cfg} onConfig={configure} />
            <PictureStatus cfg={cfg} state={state} power={power} />
          </div>
          <p className="disclaimer">3D 模擬畫面：{setup.detail}。實際光色與亮度依空間而異。</p>
          {!learning && products}
        </div>
        <div className="side">
          <ControlPanel
            setup={setup}
            cfg={cfg}
            state={state}
            power={power}
            onConfig={configure}
            onPress={userPress}
            onQuick={onQuick}
            onSlow={onSlow}
          onDemo={() => void runDemo()}
          demoing={!!demo}
            busy={busy}
            finger={finger}
            tutorial={card}
            learning={learning}
            coach={coach}
          />
        </div>
      </main>
      {footer}
    </div>
  );
}
