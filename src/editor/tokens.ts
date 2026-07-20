/**
 * Geteilte Style-Tokens für Highlight (`highlight.ts`) und Theme (`theme.ts`).
 * EINE Quelle für Farben und Font-Stack, damit der Feinschliff in M3/M6 nur hier
 * ansetzt. Exakte Werte sind bewusst vorläufig (easyMDE-Look, keine px-Parität).
 */

/** Kern-Farbwerte des SupaMDE-Basis-Looks. */
export const colors = {
  /** Blockquote-Text (gedämpftes Grau). */
  quote: '#6a737d',
  /** Links (GitHub-Blau). */
  link: '#0366d6',
  /** Container-Rahmen. */
  border: '#ddd',
} as const;

/** System-Font-Stack (kein Web-Font-Load in M1). */
export const fontStack = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
