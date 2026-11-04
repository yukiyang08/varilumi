import { FUNCTIONS, type FunctionId } from '../engine/functions';
import type { Setup } from '../scenes';
import type { WizardStep } from './Wizard';

/** 「客廳・崁燈・四段亮度」— each part reopens just that choice. */
export function Breadcrumb({ setup, functionId, onEdit }: { setup: Setup; functionId: FunctionId; onEdit: (s: WizardStep) => void }) {
  const items: [WizardStep, string, string][] = [
    ['room', '空間', setup.room.name],
    ['fixture', '燈具', setup.fixture.name],
    ['need', '功能', FUNCTIONS[functionId].plainName],
  ];
  return (
    <nav className="crumbs" aria-label="目前的選擇">
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
