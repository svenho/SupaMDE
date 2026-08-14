/**
 * Ersetzt ALLE Vorkommen von `{schlüssel}`. Benannte Platzhalter statt easyMDEs
 * `#image_name#`, und bewusst alle Vorkommen: ein Text darf `{name}` mehrfach
 * verwenden.
 *
 * Eingesetzte Werte werden NICHT erneut durchsucht — enthielte ein Wert selbst
 * `{…}`, hinge das Ergebnis sonst von der Schlüsselreihenfolge ab.
 */
export function formatText(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (treffer: string, schlüssel: string): string =>
    Object.prototype.hasOwnProperty.call(values, schlüssel) ? (values[schlüssel] as string) : treffer,
  );
}

/** Bytes als lesbare Größe — nur für die Anzeige, keine exakte Rechnung. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
