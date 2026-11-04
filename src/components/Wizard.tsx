import { FUNCTIONS, FUNCTION_ORDER, type FunctionId } from '../engine/functions';
import { FIXTURES, ROOMS, type FixtureId, type RoomId } from '../scenes';
import { FnAnim } from './FnAnim';

export type WizardStep = 'room' | 'fixture' | 'need';

interface Props {
  step: WizardStep;
  room: RoomId;
  fixture: FixtureId;
  functionId: FunctionId;
  /** editing a single choice from the breadcrumb: picking returns straight to the simulator */
  single: boolean;
  onRoom: (r: RoomId) => void;
  onFixture: (f: FixtureId) => void;
  onNeed: (f: FunctionId) => void;
  onBack: () => void;
  onSkip: () => void;
}

const THUMB = `${import.meta.env.BASE_URL}thumbs`;
const STEPS: WizardStep[] = ['room', 'fixture', 'need'];
const TITLES: Record<WizardStep, string> = {
  room: '你想看哪個空間？',
  fixture: '想裝哪一種燈？',
  need: '你最想要哪一種？',
};

/** 選空間 → 選燈具 → 選需求. Every card is one tap; defaults let visitors skip straight to trying. */
export function Wizard(p: Props) {
  const idx = STEPS.indexOf(p.step);
  const roomName = ROOMS.find((r) => r.id === p.room)!.name;
  return (
    <section className="wizard" aria-label="選擇空間與燈具">
      <div className="wiz-head">
        {!p.single && (
          <ol className="wiz-progress" aria-label={`第 ${idx + 1} 步，共 3 步`}>
            {STEPS.map((s, i) => (
              <li key={s} className={i < idx ? 'done' : i === idx ? 'cur' : ''}>
                {['空間', '燈具', '需求'][i]}
              </li>
            ))}
          </ol>
        )}
        <h2>{TITLES[p.step]}</h2>
        {p.step === 'fixture' && <p className="wiz-sub">在{roomName}裝上不同的燈，看起來會是這樣：</p>}
        {p.step === 'need' && <p className="wiz-sub">選一個最接近你的需求，等一下都還能換。</p>}
      </div>

      {p.step === 'room' && (
        <div className="wiz-grid">
          {ROOMS.map((r) => (
            <button key={r.id} type="button" className={`wiz-card ${r.id === p.room ? 'active' : ''}`} onClick={() => p.onRoom(r.id)}>
              <span className="wiz-img">
                <img src={`${THUMB}/${r.id}.webp`} alt="" loading="lazy" />
              </span>
              <b>{r.name}</b>
              <small>{r.blurb}</small>
            </button>
          ))}
        </div>
      )}

      {p.step === 'fixture' && (
        <div className="wiz-grid">
          {FIXTURES.map((f) => (
            <button key={f.id} type="button" className={`wiz-card ${f.id === p.fixture ? 'active' : ''}`} onClick={() => p.onFixture(f.id)}>
              <span className="wiz-img">
                <img src={`${THUMB}/${p.room}-${f.id}.webp`} alt="" loading="lazy" />
              </span>
              <b>{f.name}</b>
              <small>{f.blurb}</small>
            </button>
          ))}
        </div>
      )}

      {p.step === 'need' && (
        <div className="wiz-needs">
          {FUNCTION_ORDER.map((id) => {
            const f = FUNCTIONS[id];
            return (
              <button key={id} type="button" className={`need-card ${id === p.functionId ? 'active' : ''}`} onClick={() => p.onNeed(id)}>
                <span className="need-text">
                  <b>{f.need}</b>
                  <small>{f.needDesc}</small>
                </span>
                <FnAnim id={id} />
                <span className="need-name">
                  {f.plainName}・<span>{f.family}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="wiz-foot">
        {(idx > 0 || p.single) && (
          <button type="button" className="link" onClick={p.onBack}>
            ← {p.single ? '回到試按' : '上一步'}
          </button>
        )}
        {!p.single && (
          <button type="button" className="link skip" onClick={p.onSkip}>
            直接試按 →
          </button>
        )}
      </div>
    </section>
  );
}
