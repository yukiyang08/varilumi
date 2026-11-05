import { FUNCTIONS, type FunctionId } from '../engine/functions';
import { kelvinSwatch } from './ControlPanel';

/**
 * Tiny looping picture of what a function does when you keep toggling the switch:
 * a row of "bulbs" lighting up step by step (four-step / tri-colour) or a fill that glides (stepless).
 */
export function FnAnim({ id }: { id: FunctionId }) {
  const def = FUNCTIONS[id];
  if (def.mode === 'multi-stepless') {
    const n = def.colors!.length;
    return (
      <span className="fn-anim multi" aria-hidden="true" style={{ ['--n' as string]: n }}>
        {def.colors!.map((k, i) => (
          <span key={i} className="mini-glide" style={{ ['--i' as string]: i, ['--c' as string]: kelvinSwatch(k) }}>
            <span />
          </span>
        ))}
      </span>
    );
  }
  if (def.mode === 'stepless') {
    return (
      <span className="fn-anim stepless" aria-hidden="true">
        <span className="glide" />
      </span>
    );
  }
  const n = def.steps.length;
  return (
    <span className="fn-anim steps" aria-hidden="true" style={{ ['--n' as string]: n }}>
      {def.steps.map((s, i) => (
        <span
          key={i}
          className="bulb"
          style={{
            ['--i' as string]: i,
            ['--c' as string]: kelvinSwatch(s.kelvin ?? 4000),
            ['--o' as string]: 0.25 + 0.75 * Math.sqrt(s.level),
          }}
        />
      ))}
    </span>
  );
}
