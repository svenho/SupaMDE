import toolbarCss from './toolbar.css?inline';
import statusbarCss from './statusbar.css?inline';
import previewCss from './preview.css?inline';
import fullscreenCss from './fullscreen.css?inline';

/**
 * Marker-Attribut am erzeugten `<style>`-Tag. Dient zwei Zwecken: Idempotenz
 * (mehrere SupaMDE-Instanzen teilen sich EIN Tag) und Auffindbarkeit für
 * Host-Projekte, die die Regeln gezielt überschreiben oder entfernen wollen.
 */
const MARKER = 'data-supamde-styles';

/** Die gebündelten SupaMDE-Styles als String — dieselben Quellen wie `dist/supamde.css`. */
const CSS = [toolbarCss, statusbarCss, previewCss, fullscreenCss].join('\n');

/**
 * Fügt die SupaMDE-Styles EINMALIG als `<style>`-Tag in den Head ein.
 *
 * Im Library-Build extrahiert Vite `import './x.css'` in eine separate Datei
 * (`dist/supamde.css`), die ein blosses `import SupaMDE from 'supamde'` NICHT
 * mitlädt — die Toolbar käme ungestylt an. Deshalb liegt das CSS zusätzlich
 * per `?inline` als String im Bundle und wird hier zur Laufzeit gesetzt.
 *
 * Das Tag landet als ERSTES Kind im Head, damit Host-Stylesheets bei gleicher
 * Spezifität gewinnen (spätere Regel schlägt frühere) und Overrides ohne
 * `!important` möglich bleiben.
 */
export function injectStyles(doc: Document = document): void {
  // SSR-/Nicht-DOM-Umgebungen: ohne Head gibt es nichts zu tun.
  const head = doc.head;
  if (!head) return;
  if (head.querySelector(`style[${MARKER}]`)) return;

  const style = doc.createElement('style');
  style.setAttribute(MARKER, '');
  style.textContent = CSS;
  head.insertBefore(style, head.firstChild);
}
