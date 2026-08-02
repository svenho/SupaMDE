/**
 * Ergänzt bei allen <a>-Tags ohne target ein target="_blank" plus
 * rel="noopener noreferrer". Minimales Sanitizing für die Preview — kein
 * DOMPurify (bewusste Scope-Grenze, siehe Design §3.4).
 */
export function addAnchorTargetBlank(html: string): string {
  return html.replace(/<a\b(?![^>]*\btarget=)([^>]*)>/gi, '<a target="_blank" rel="noopener noreferrer"$1>');
}
