import type { ToolbarOption } from './ui/toolbar-config';
import type { StatusOption } from './ui/statusbar';
import type { KeyBinding } from '@codemirror/view';
import { EDITOR_MODES, type EditorMode } from './livepreview';

/** Öffentliche Konfigurationsoptionen für SupaMDE (Kern-Set, M1). */
export interface SupaMDEOptions {
  /** Das Textarea-Element, an das der Editor gebunden wird. */
  element?: HTMLElement | null;
  /** Zeilenumbruch statt horizontalem Scrollen (Default: true). */
  lineWrapping?: boolean;
  /** Platzhaltertext im leeren Editor. */
  placeholder?: string;
  /** Fokussiert den Editor nach Erzeugung (Default: false). */
  autofocus?: boolean;
  /** Tab-Breite in Spalten (Default: 2). */
  tabSize?: number;
  /** Einrücktiefe in Leerzeichen (Default: 2). */
  indentUnit?: number;
  /** Startwert; überschreibt den Textarea-Inhalt, falls gesetzt. */
  initialValue?: string;
  /** Eigene Tastenkürzel; haben Vorrang vor den SupaMDE-Defaults bei Konflikten. */
  extraKeys?: KeyBinding[];
  /**
   * Darstellungsmodus: `'source'` zeigt das Markdown-Markup (Default),
   * `'live'` blendet es aus und zeigt es nur am Cursor (Obsidian-Stil).
   */
  editorMode?: EditorMode;
  /** Toolbar-Konfiguration: false (aus), oder Liste aus Built-in-Namen/Custom-Buttons. */
  toolbar?: ToolbarOption;
  /** Statusbar-Konfiguration: false (aus), oder Liste aus Built-in-Namen/Custom-Items. */
  status?: StatusOption;
  /** Ersetzt den eingebauten Markdown-Renderer der Vorschau komplett. */
  previewRender?: (text: string) => string;
  /** Zusätzliche CSS-Klasse(n) aufs Vorschau-Panel. */
  previewClass?: string | string[];
  /** marked-Feintuning für die Vorschau. */
  renderingConfig?: { singleLineBreaks?: boolean };
  /** Bidirektionaler Scroll-Sync im Side-by-Side (Default true). */
  syncSideBySidePreviewScroll?: boolean;
  /** Callback bei Fullscreen-Wechsel. */
  onToggleFullScreen?: (active: boolean) => void;
  /**
   * Fügt die SupaMDE-Styles automatisch als `<style>`-Tag in den Head ein
   * (Default: true). Auf `false` setzen, wenn das Host-Projekt die Styles
   * selbst kontrolliert — dann muss `supamde/style.css` manuell eingebunden
   * werden, sonst bleiben Toolbar und Statusbar ungestylt.
   */
  injectStyles?: boolean;
}

/** Normalisierte, immer vollständig belegte Optionen für die Extension-Erzeugung. */
export interface ResolvedOptions {
  lineWrapping: boolean;
  placeholder: string | null;
  autofocus: boolean;
  tabSize: number;
  indentUnit: number;
  extraKeys: KeyBinding[];
  editorMode: EditorMode;
}

/**
 * Prüft den Modus-Wert und fällt bei Unsinn auf `'source'` zurück. Bewusst kein
 * Wurf: Ein falscher DARSTELLUNGSmodus darf den Editor nicht am Starten hindern
 * (gleiches Muster wie `resolveToolbar` bei unbekannten Aktionsnamen).
 */
function resolveEditorMode(mode: EditorMode | undefined): EditorMode {
  if (mode === undefined) return 'source';
  if (EDITOR_MODES.includes(mode)) return mode;
  console.warn(`SupaMDE: unbekannter editorMode "${String(mode)}" — nutze "source".`);
  return 'source';
}

/** Füllt fehlende Optionen mit Defaults und liefert eine vollständige Form. */
export function resolveOptions(options: SupaMDEOptions): ResolvedOptions {
  return {
    lineWrapping: options.lineWrapping ?? true,
    placeholder: options.placeholder ?? null,
    autofocus: options.autofocus ?? false,
    tabSize: options.tabSize ?? 2,
    indentUnit: options.indentUnit ?? 2,
    extraKeys: options.extraKeys ?? [],
    editorMode: resolveEditorMode(options.editorMode),
  };
}
