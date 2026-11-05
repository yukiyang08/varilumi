import type { Setup } from '../scenes';
import type { WizardStep } from './Wizard';

/**
 * 「客廳・崁燈」— each part reopens just that choice. The function is chosen in one place only:
 * the function buttons under the picture, which are always on screen.
 */
export function Breadcrumb({ setup, onEdit }: { setup: Setup; onEdit: (s: WizardStep) => void }) {
  const items: [WizardStep, string, string][] = [
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
