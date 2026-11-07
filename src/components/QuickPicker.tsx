import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FUNCTIONS, FUNCTION_ORDER, type FunctionId } from '../engine/functions';
import { FIXTURES, ROOMS, type FixtureId, type RoomId } from '../scenes';
import { FnAnim } from './FnAnim';
import type { PickKind } from './Breadcrumb';
import { portalTarget } from '../root';

interface Props {
  kind: PickKind;
  room: RoomId;
  fixture: FixtureId;
  functionId: FunctionId;
  onRoom: (r: RoomId) => void;
  onFixture: (f: FixtureId) => void;
  onNeed: (f: FunctionId) => void;
  onClose: () => void;
  /** phones: a bottom sheet rendered at the top of the page (portal), above the pinned picture and the dock */
  sheet?: boolean;
}

const THUMB = `${import.meta.env.BASE_URL}thumbs`;
const TITLE: Record<PickKind, string> = { room: '換一個空間', fixture: '換一種燈', need: '換一個功能' };

/**
 * Change one choice without leaving the simulator: a bottom sheet on phones, a panel under the
 * breadcrumb on desktop. Picking applies at once and closes; the page does not scroll or reload.
 */
export function QuickPicker(p: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(p.onClose);
  close.current = p.onClose;

  // once per opening (the app re-renders every animation frame, so this must not depend on props)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', onKey);
    panel.current?.querySelector<HTMLButtonElement>('button.active')?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [p.kind]);

  const ui = (
    <>
      <div className={`qp-backdrop ${p.sheet ? 'qp-sheet' : ''}`} onClick={p.onClose} aria-hidden="true" />
      <div className={`qp ${p.sheet ? 'qp-sheet' : ''}`} role="dialog" aria-modal="true" aria-label={TITLE[p.kind]} ref={panel}>
        <div className="qp-head">
          <b>{TITLE[p.kind]}</b>
          <button type="button" className="link" onClick={p.onClose}>
            完成
          </button>
        </div>

        {p.kind === 'room' && (
          <div className="qp-grid">
            {ROOMS.map((r) => (
              <button key={r.id} type="button" className={`qp-item ${r.id === p.room ? 'active' : ''}`} aria-pressed={r.id === p.room} onClick={() => p.onRoom(r.id)}>
                <img src={`${THUMB}/${r.id}-${p.fixture}.webp`} alt="" />
                <b>{r.name}</b>
              </button>
            ))}
          </div>
        )}

        {p.kind === 'fixture' && (
          <div className="qp-grid">
            {FIXTURES.map((f) => (
              <button key={f.id} type="button" className={`qp-item ${f.id === p.fixture ? 'active' : ''}`} aria-pressed={f.id === p.fixture} onClick={() => p.onFixture(f.id)}>
                <img src={`${THUMB}/${p.room}-${f.id}.webp`} alt="" />
                <b>{f.name}</b>
              </button>
            ))}
          </div>
        )}

        {p.kind === 'need' && (
          <div className="qp-needs">
            {FUNCTION_ORDER.map((id) => {
              const f = FUNCTIONS[id];
              return (
                <button key={id} type="button" className={`qp-need ${id === p.functionId ? 'active' : ''}`} aria-pressed={id === p.functionId} onClick={() => p.onNeed(id)}>
                  <span>
                    <b>{f.plainName}</b>
                    <small>{f.needDesc}</small>
                  </span>
                  <FnAnim id={id} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
  return p.sheet ? createPortal(ui, portalTarget()) : ui;
}
