/**
 * Analytics without loading GA here: when the lab runs inside the Varilumi site (iframe via the WordPress
 * plugin), each event is handed to the parent page, which forwards it to the site's own GA as `lab_<event>`.
 * Mounted straight into a varilumi.com page (embed.js) it calls the site's gtag / dataLayer itself.
 * Standalone it does nothing. Only event names and short labels are sent, never anything about the visitor.
 */
export function track(event: string, params: Record<string, string | number | boolean> = {}) {
  try {
    const w = window as unknown as { gtag?: (...a: unknown[]) => void; dataLayer?: object[] };
    if (window.parent !== window) window.parent.postMessage({ source: 'varilumi-lab', event, params }, '*');
    else if (typeof w.gtag === 'function') w.gtag('event', `lab_${event}`, params);
    else w.dataLayer?.push({ ...params, event: `lab_${event}` });
  } catch {
    /* not embedded or blocked */
  }
}
