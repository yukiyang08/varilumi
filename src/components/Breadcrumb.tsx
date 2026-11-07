import { FIXTURES, ROOMS, type FixtureId, type RoomId, type Setup } from '../scenes';
/** Which choice an in-place picker edits. */
export type PickKind = 'room' | 'fixture' | 'need';

/**
 * 「客廳・崁燈」— each part reopens just that choice. The function is chosen in one place only:
 * the function buttons under the picture, which are always on screen.
 */
export function Breadcrumb({ setup, onEdit }: { setup: Setup; onEdit: (s: PickKind) => void }) {
  const items: [PickKind, string, string][] = [
    ['room', '空間', setup.room.name],
    ['fixture', '燈具', setup.fixture.name],
  ];
  return (
    <nav className="crumbs" aria-label="目前的空間與燈具">
      {items.map(([step, label, value]) => (
        <button key={step} type="button" className="crumb" onClick={() => onEdit(step)} aria-label={`更換${label}，目前是${value}`}>
          <small>{label}</small>
          <b>{value}</b>
          <span className="caret" aria-hidden="true">▾</span>
        </button>
      ))}
    </nav>
  );
}

/** Desktop: every room and fixture laid out as segmented buttons, one click to switch. */
export function SceneTabs({ room, fixture, onRoom, onFixture }: { room: RoomId; fixture: FixtureId; onRoom: (r: RoomId) => void; onFixture: (f: FixtureId) => void }) {
  return (
    <div className="scene-tabs-row">
      <div className="seg" role="radiogroup" aria-label="空間">
        <span className="seg-label">空間</span>
        {ROOMS.map((r) => (
          <button key={r.id} type="button" role="radio" aria-checked={r.id === room} className={r.id === room ? 'active' : ''} onClick={() => onRoom(r.id)}>
            {r.name}
          </button>
        ))}
      </div>
      <div className="seg" role="radiogroup" aria-label="燈具">
        <span className="seg-label">燈具</span>
        {FIXTURES.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={f.id === fixture} className={f.id === fixture ? 'active' : ''} onClick={() => onFixture(f.id)}>
            {f.name}
          </button>
        ))}
      </div>
    </div>
  );
}
