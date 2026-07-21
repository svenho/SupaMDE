/**
 * Zentrale Definition aller markdown-Zeilen-Präfixe, die von mehreren Command-
 * Modulen erkannt/entfernt werden. Eine einzige Quelle verhindert, dass sich
 * `block.ts`, `list.ts` und `cleanBlock` in ihren Regexes auseinanderentwickeln.
 * Reihenfolge ist bedeutsam: spezifischere Muster (Checkliste) VOR allgemeineren
 * (Aufzählungsstrich) prüfen.
 */
export const LINE_PREFIXES: readonly RegExp[] = [
  /^#{1,6} /, // Heading
  /^> /, // Blockzitat
  /^- \[[ xX]\] /, // Checkliste (vor "- ")
  /^\d+\. /, // geordnete Liste
  /^- /, // ungeordnete Liste
];

/**
 * Trennt ein erkanntes Zeilen-Präfix vom Rest der Zeile. Liefert `null`, wenn die
 * Zeile mit keinem bekannten Präfix beginnt.
 */
export function stripLinePrefix(text: string): { prefix: string; rest: string } | null {
  for (const re of LINE_PREFIXES) {
    const m = re.exec(text);
    if (m) return { prefix: m[0], rest: text.slice(m[0].length) };
  }
  return null;
}
