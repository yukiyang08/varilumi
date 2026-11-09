import { useEffect, useState } from 'react';
import { appRoot } from '../root';

const PAD = 6;

/**
 * Dims the whole screen except the elements matching `targets` (one CSS selector per hole).
 * Rects are re-measured every frame, so the holes follow scrolling, resizing and layout changes.
 * It ignores pointer events, so everything stays usable underneath.
 */
export function Spotlight({ targets }: { targets: string[] }) {
  const [rects, setRects] = useState<DOMRect[]>([]);
  const key = targets.join('|');

  useEffect(() => {
    let raf = 0;
    let last = '';
    const tick = () => {
      const rs = targets.flatMap((sel) => {
        const el = appRoot.querySelector(sel);
        return el ? [el.getBoundingClientRect()] : [];
      });
      const sig = rs.map((r) => `${r.left|0},${r.top|0},${r.width|0},${r.height|0}`).join(';');
      if (sig !== last) {
        last = sig;
        setRects(rs);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Phones: a finger scroll moved the page under the pinned overlay (the holes lagged and the lesson could be
  // scrolled away into a dark screen). Each step scrolls its target into view itself, so touch scrolling
  // pauses while the spotlight is on. Taps still work; 跳過教學 ends it.
  useEffect(() => {
    const stop = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', stop, { passive: false });
    return () => document.removeEventListener('touchmove', stop);
  }, []);

  return (
    <svg className="spotlight" aria-hidden="true">
      <defs>
        <mask id="spot-holes">
          <rect width="100%" height="100%" fill="#fff" />
          {rects.map((r, i) => (
            <rect key={i} x={r.left - PAD} y={r.top - PAD} width={r.width + PAD * 2} height={r.height + PAD * 2} rx={16} fill="#000" />
          ))}
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(18, 14, 10, 0.62)" mask="url(#spot-holes)" />
    </svg>
  );
}
