/**
 * Where the lab's DOM lives: the page itself (GitHub Pages), or a shadow root when the WordPress plugin
 * mounts it straight into a varilumi.com page (see embed.tsx). Lookups and portals go through this.
 */
export let appRoot: Document | ShadowRoot = document;
export const setAppRoot = (r: ShadowRoot) => (appRoot = r);
export const portalTarget = (): Element | ShadowRoot => (appRoot === document ? document.body : (appRoot as ShadowRoot));
