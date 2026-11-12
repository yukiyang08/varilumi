/**
 * Where the lab's DOM lives: the page itself (GitHub Pages), or a shadow root when the WordPress plugin
 * mounts it straight into a varilumi.com page (see embed.tsx). Lookups and portals go through this.
 */
export let appRoot: Document | ShadowRoot = document;
export const setAppRoot = (r: ShadowRoot) => (appRoot = r);
/** Set by the WordPress plugin on varilumi.com (data-wp on the lab's element); null on GitHub Pages. */
export interface WpConfig {
  api: string; // REST endpoint that takes the survey and issues the coupon
  nonce: string; // REST nonce; empty when nobody is logged in
  login: string; // login / register page that comes back to the lab with ?vl_survey=1
  shop: boolean; // WooCommerce is active
  privacy: string; // the site's privacy policy page, may be empty
  offer: { amount: number; min: number; days: number };
  claimed: Claimed | null;
}
export interface Claimed {
  code: string;
  expires: string | null;
  used: boolean;
}
export let wp: WpConfig | null = null;
export const setWp = (c: WpConfig) => (wp = c);

export const portalTarget = (): Element | ShadowRoot => (appRoot === document ? document.body : (appRoot as ShadowRoot));
