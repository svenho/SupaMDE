/**
 * Typen für Vites CSS-Imports.
 *
 * Bewusst hier statt über `vite/client`: `tsconfig.build.json` setzt
 * `types: []`, damit die Deklarations-Emission keine Ambient-Typen aus
 * node_modules einzieht. Diese Datei liegt unter `src` und wird darum von
 * beiden tsconfigs erfasst.
 */

/** `?inline` liefert den CSS-Text als String — für `ui/inject-styles.ts`. */
declare module '*.css?inline' {
  const css: string;
  export default css;
}

/** Seiteneffekt-Import; extrahiert im Library-Build nach `dist/supamde.css`. */
declare module '*.css' {
  const css: string;
  export default css;
}
