import { EditorView, ViewPlugin, type PluginValue, type ViewUpdate } from '@codemirror/view';
import { linkUrlAt } from './link-click';

/** CSS-Klasse auf `view.contentDOM`, die den Mauszeiger zur Klickhand macht. */
export const LINK_HOVER_CLASS = 'supamde-link-hover';

/** Wahr, wenn genau der Modifier gedrückt ist, der Cmd/Ctrl+Klick auslöst. */
function isLinkModifier(event: KeyboardEvent | MouseEvent): boolean {
  return event.ctrlKey || event.metaKey;
}

/**
 * Hält den Zustand "Zeiger steht auf einem klickbaren Link UND Modifier ist
 * gedrückt" und spiegelt ihn als CSS-Klasse auf `view.contentDOM` — wie in
 * VS Code soll der Mauszeiger dann zur Klickhand werden.
 *
 * Die Klasse muss laut Vorgabe SOFORT bei Tastendruck erscheinen (nicht erst
 * bei der nächsten Mausbewegung) und sofort beim Loslassen verschwinden.
 * Deshalb wird zusätzlich zu `mousemove` die zuletzt bekannte Mausposition
 * vorgehalten und bei `keydown`/`keyup` sofort neu bewertet.
 *
 * `keydown`/`keyup` hängen bewusst am `window` und nicht am `view.contentDOM`:
 * Modifier-Tasten sollen auch dann erkannt werden, wenn der Editor gerade
 * nicht fokussiert ist (z.B. Fokus in einem Toolbar-Button), weil der Nutzer
 * die Taste schon VOR dem Zurückbewegen der Maus in den Editor drücken kann.
 * Ein Editor-lokaler Listener würde dieses Timing verpassen.
 */
class LinkHoverCursorPlugin implements PluginValue {
  private view: EditorView;
  private lastX = 0;
  private lastY = 0;
  private hasMousePosition = false;
  private modifierDown = false;

  // Als gebundene Instanzmethoden gespeichert, damit dieselbe Referenz bei
  // add-/removeEventListener verwendet werden kann (sonst kein Entfernen möglich).
  private readonly onMouseMove = (event: MouseEvent): void => {
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.hasMousePosition = true;
    this.updateState();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!isLinkModifier(event)) return;
    this.modifierDown = true;
    this.updateState();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    // Beim Loslassen EINER der beiden Modifier-Tasten (Ctrl/Meta) sofort neu
    // bewerten — `event.ctrlKey`/`event.metaKey` spiegeln bereits den Zustand
    // NACH dem Loslassen wider.
    if (event.key !== 'Control' && event.key !== 'Meta') return;
    this.modifierDown = event.ctrlKey || event.metaKey;
    this.updateState();
  };

  private readonly onBlur = (): void => {
    // Fenster verloren den Fokus (z.B. App-Wechsel bei gehaltenem Cmd) — der
    // Modifier-Zustand ist dann nicht mehr zuverlässig beobachtbar, also
    // zurücksetzen, damit keine "hängende" Klickhand stehen bleibt.
    this.modifierDown = false;
    this.updateState();
  };

  constructor(view: EditorView) {
    this.view = view;
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  update(_update: ViewUpdate): void {
    // Nach jeder View-Änderung (z.B. Bearbeitung, Cursorbewegung) neu bewerten:
    // derselbe Bildschirmpunkt kann jetzt auf anderen Dokumentinhalt zeigen.
    //
    // Bewusst NICHT direkt `updateState()`: dessen `posAtCoords()` liest das
    // Editor-Layout, und das ist während eines laufenden View-Updates verboten
    // ("Reading the editor layout isn't allowed during an update"). CM6 fing das
    // als "CodeMirror plugin crashed" ab, z.B. bei Cmd+Pfeil-links. In der
    // Measure-Phase ist das Lesen erlaubt, also dorthin verschieben.
    if (!this.modifierDown || !this.hasMousePosition) return;
    this.view.requestMeasure({ read: () => this.updateState() });
  }

  destroy(): void {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  private updateState(): void {
    const shouldShow = this.modifierDown && this.hasMousePosition && this.pointerIsOverLink();
    this.view.contentDOM.classList.toggle(LINK_HOVER_CLASS, shouldShow);
  }

  private pointerIsOverLink(): boolean {
    const pos = this.view.posAtCoords({ x: this.lastX, y: this.lastY });
    if (pos === null) return false;
    return linkUrlAt(this.view.state, pos) !== null;
  }
}

/**
 * Zeigt beim Hover mit gedrücktem Cmd/Ctrl-Modifier über einem klickbaren
 * Link den Mauszeiger als Klickhand (`cursor: pointer`) — wie in VS Code.
 * Die CSS-Regel dazu steht in `theme.ts` (`.${LINK_HOVER_CLASS}`).
 *
 * Modusunabhängig einzuhängen, analog zu `linkClickExtension`.
 */
export const linkHoverCursorExtension = ViewPlugin.fromClass(LinkHoverCursorPlugin);
