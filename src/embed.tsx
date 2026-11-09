/**
 * Entry for varilumi.com: the WordPress plugin puts <div id="varilumi-lab"> on the page and loads this file
 * from GitHub Pages. The lab renders right in the page (no iframe, so only the site scrolls), inside a
 * shadow root so the theme's CSS and the lab's CSS can't touch each other.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import css from './styles.css?inline';
import { setAppRoot } from './root';

const host = document.getElementById('varilumi-lab');
if (host && !host.shadowRoot) {
  const shadow = host.attachShadow({ mode: 'open' });
  setAppRoot(shadow);
  const style = document.createElement('style');
  // the stylesheet is written for a whole page: its :root and body rules become the host's
  style.textContent = ':host{all:initial;display:block}' + css.replace(/:root\b/g, ':host').replace(/(^|[{},\s])body(?=\s*[{,])/g, '$1:host');
  const mount = document.createElement('div');
  shadow.append(style, mount);
  // @font-face only works from the page, not from inside a shadow root
  const font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap';
  document.head.append(font);
  // The site's own sticky / fixed header (and the WP admin bar) would cover the lab's sticky picture and
  // tabs: measure what is pinned at the top of the screen and keep the lab's sticky parts below it.
  const fitTop = () => {
    let top = 0;
    for (const el of document.elementsFromPoint(innerWidth / 2, 1)) {
      if (el === host || host.contains(el)) continue;
      for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
        const pos = getComputedStyle(e).position;
        if (pos === 'fixed' || pos === 'sticky') {
          top = Math.max(top, e.getBoundingClientRect().bottom);
          break;
        }
      }
    }
    host.style.setProperty('--vl-top', `${Math.round(top)}px`);
  };
  // The site's floating buttons (e.g. the LINE chat bubble, bottom-right) would cover the phone switch dock
  // (快切 sits there): lift any small fixed element that overlaps the dock to just above it.
  const lifted = new Map<HTMLElement, string>(); // element → its own inline transform
  const liftOverDock = () => {
    const dock = shadow.querySelector('.m-dock')?.getBoundingClientRect();
    if (!dock) {
      lifted.forEach((t, el) => (el.style.transform = t));
      lifted.clear();
      return;
    }
    const y = dock.top + dock.height / 2;
    for (const x of [24, innerWidth / 2, innerWidth - 24]) {
      for (const hit of document.elementsFromPoint(x, y)) {
        if (hit === host || host.contains(hit)) continue;
        let e = hit as HTMLElement | null;
        while (e && e !== document.body && getComputedStyle(e).position !== 'fixed') e = e.parentElement;
        // ponytail: only small floating things; a full-width bottom bar of the theme is left alone
        if (e && e !== document.body && !lifted.has(e) && e.getBoundingClientRect().width < innerWidth / 2) lifted.set(e, e.style.transform);
      }
    }
    lifted.forEach((t, el) => {
      el.style.transform = t; // measure where it sits on its own
      const dy = el.getBoundingClientRect().bottom - dock.top + 8;
      el.style.transform = dy > 0 ? `${t} translateY(${-dy}px)` : t;
    });
  };
  let raf = 0;
  const queue = () => (raf ||= requestAnimationFrame(() => ((raf = 0), fitTop(), liftOverDock())));
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  setInterval(queue, 1500); // chat widgets load late
  fitTop();

  createRoot(mount).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
