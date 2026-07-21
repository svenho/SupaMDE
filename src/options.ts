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
}

/** Normalisierte, immer vollständig belegte Optionen für die Extension-Erzeugung. */
export interface ResolvedOptions {
  lineWrapping: boolean;
  placeholder: string | null;
  autofocus: boolean;
  tabSize: number;
  indentUnit: number;
}

/** Füllt fehlende Optionen mit Defaults und liefert eine vollständige Form. */
export function resolveOptions(options: SupaMDEOptions): ResolvedOptions {
  return {
    lineWrapping: options.lineWrapping ?? true,
    placeholder: options.placeholder ?? null,
    autofocus: options.autofocus ?? false,
    tabSize: options.tabSize ?? 2,
    indentUnit: options.indentUnit ?? 2,
  };
}
