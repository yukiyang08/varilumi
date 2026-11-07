/**
 * Analytics without loading GA here: when the lab runs inside the Varilumi site (iframe via the WordPress
 * plugin), each event is handed to the parent page, which forwards it to the site's own GA as `lab_<event>`.
 * Standalone it does nothing. Only event names and short labels are sent, never anything about the visitor.
 */
export function track(event: string, params: Record<string, string | number | boolean> = {}) {
  try {
    if (window.parent !== window) window.parent.postMessage({ source: 'varilumi-lab', event, params }, '*');
  } catch {
    /* not embedded or blocked */
  }
}
