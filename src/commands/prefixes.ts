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
  /^[-*] /, // ungeordnete Liste: SupaMDE erzeugt "* ", erkennt aber auch "- "
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

/**
 * Zählt den zu entfernenden führenden Whitespace einer Zeile: bis zu `unit`
 * Leerzeichen, weniger wenn weniger vorhanden sind. Ein führendes Tab-Zeichen
 * zählt als eine vollständige Einrückstufe und wird als Ganzes entfernt.
 * `0`, wenn die Zeile nicht mit Whitespace beginnt.
 */
export function dedentWidth(text: string, unit: number): number {
  if (text.startsWith('\t')) return 1;
  let width = 0;
  while (width < unit && text[width] === ' ') width++;
  return width;
}
