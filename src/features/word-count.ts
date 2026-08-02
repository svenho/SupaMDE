/**
 * Zählt Wörter in `text`: durch Whitespace getrennte, nicht-leere Tokens.
 * Reine Funktion — das neue Sicherheitsnetz, das easyMDE fehlt.
 */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}
