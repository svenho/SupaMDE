# Design: CM6 als Peer Dependency (Externalisierung)

**Datum:** 2026-07-23
**Status:** Genehmigt

## Ziel

CM6/Lezer nicht mehr inline ins `supamde.mjs` bündeln, sondern als
Peer Dependencies ausweisen. Konsumenten installieren CM6 selbst; ihr Bundler
löst die Imports auf und dedupet über npm. Keine API-Änderung an SupaMDE.

## Motivation

Aktuell sind `@codemirror/*` und `@lezer/*` reguläre `dependencies` und werden
von Vite inline ins Bundle gebaut → `supamde.mjs` ist ~628 KB, wovon der Großteil
CM6 ist. Konsumenten, die CM6 ohnehin selbst nutzen, bekommen es doppelt und
riskieren mehrere inkompatible CM6-Instanzen (Extensions/State passen dann nicht
zusammen). Externalisierung ist der etablierte Standard für CM6-Erweiterungspakete
(alle offiziellen `@codemirror/*`-Pakete machen es so) und löst das Dedupe-Problem
über npm automatisch.

## Betroffene Pakete (8)

Als `peerDependencies` **und** gespiegelt in `devDependencies`:

- `@codemirror/view`
- `@codemirror/state`
- `@codemirror/commands`
- `@codemirror/language`
- `@codemirror/lang-markdown`
- `@lezer/highlight`
- `@lezer/markdown`
- `@lezer/common` — wird in `src/commands/inline.ts` als Typ importiert, fehlt
  aber bisher in package.json; wird hier nachgetragen.

Alle Imports gehen auf die Paket-Wurzel (keine Sub-Pfad-Imports wie
`@codemirror/view/dist/…`).

## Änderungen im Einzelnen

### 1. `vite.config.ts`

- `build.lib.formats`: `['es', 'umd']` → `['es']`. UMD raus (ESM-only; der
  UMD-Einstieg wurde bereits früher entfernt, weil er ein leeres Objekt lieferte).
  Folge: `dist/supamde.js` wird nicht mehr erzeugt.
- `build.rollupOptions.external`: RegExp `/^@(codemirror|lezer)\//` —
  externalisiert alle CM6/Lezer-Pakete inkl. etwaiger künftiger Sub-Pfade.

### 2. `package.json`

- Die 8 Pakete von `dependencies` → `peerDependencies` verschieben, plus
  `@lezer/common` neu aufnehmen. Versionsbereiche bleiben wie aktuell
  (`^6.43.6` etc.) — Caret ist bereits Major-tolerant.
- Dieselben 8 Pakete zusätzlich in `devDependencies` eintragen (für lokalen
  Build/Test/Dev-Server).
- `dependencies` wird dadurch leer → Feld entfernen.

### 3. `example/index.html`

- Import umstellen: `../dist/supamde.mjs` → `../src/index.ts`.
- Lauf über `npm run dev` (Vite-Dev-Server) statt direktem Datei-Öffnen. Vite
  löst die Bare-Imports aus node_modules auf und dedupet CM6 — exakt das
  Konsumenten-Szenario „eigener Bundler".

### 4. `README.md`

- Installations-/Einbindungsabschnitt ergänzen: Konsumenten müssen die CM6-Peers
  mitinstallieren (ein `npm install`-Beispiel mit allen 8 Paketen).

## Verifikation

- `npm run build` → `supamde.mjs` enthält **keinen** CM6-Code mehr (Größe fällt
  von ~628 KB auf wenige KB); die nackten `import … from '@codemirror/*'` bleiben
  im Output stehen.
- `dist/supamde.js` (UMD) wird nicht mehr erzeugt.
- `npm run typecheck` und `npm run test:run` bleiben grün (node_modules-Auflösung
  via devDependencies).
- `npm run dev` → Beispiel lädt und funktioniert im Browser.

## Bewusste Nicht-Ziele (YAGNI)

- Keine Runtime-Injection-API, keine Import-Map, kein CDN-Setup.
- Keine Versions-Verschärfung der CM6-Ranges.
- CSS/Theme unangetastet (läuft über `EditorView.theme`, kein CSS-Import).
