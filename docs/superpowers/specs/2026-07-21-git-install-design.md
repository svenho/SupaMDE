# Design: SupaMDE aus Git installierbar machen

**Datum:** 2026-07-21
**Ziel:** SupaMDE soll aus einem anderen Projekt heraus per
`npm install git+https://github.com/svenho/SupaMDE.git` installierbar sein und
sofort nutzbar sein (`import SupaMDE from 'supamde'`).

## Kontext

- Repo ist öffentlich: `github.com/svenho/SupaMDE.git`.
- Package-Name in `package.json`: `supamde`. Der in der Anfrage genannte Name
  `gm-mini` ist ein anderes Modul und hier **nicht** relevant.
- Styling läuft vollständig über CodeMirror-6-Themes (`EditorView.theme(...)`,
  siehe `src/editor/theme.ts`), die CM6 zur Laufzeit ins DOM injiziert. Es gibt
  **keine** separate CSS-Datei und keinen Grund, eine zu erzeugen. Konsumenten
  müssen **kein** CSS importieren.
- CodeMirror 6 ist als normale `dependencies` deklariert und bleibt so — bewusst
  gegen `peerDependencies` entschieden (siehe „Verworfene Alternativen").

## Blockierende Probleme (Ausgangslage)

1. **`dist/` ist in `.gitignore`** und nicht in Git eingecheckt. `package.json`
   verweist mit `main`/`module`/`types` aber genau dorthin. Ein frischer Klon
   hätte kein `dist/` → Package wäre kaputt.
2. **Kein `prepare`-Script.** Ohne `prepare` baut npm bei einer Git-Installation
   nicht automatisch.
3. **Toter CSS-Export.** `exports["./dist/supamde.css"]` zeigt auf eine Datei,
   die nie erzeugt wird.

## Lösungsansatz: `prepare`-Build (Ansatz A)

`dist/` bleibt aus Git heraus. Ein `prepare`-Script baut bei jeder Installation
(inkl. Git-Install) frisch. Das ist das npm-Standardidiom für „aus Git
installierbar" und die direkte Vorstufe zum späteren npm-Publish.

### Verworfene Alternativen

- **`dist/` einchecken:** ~5 MB Build-Artefakte inkl. Sourcemaps im Git-Verlauf,
  must-commit-on-every-change. Anti-Pattern.
- **Separater schlanker Dist-Build:** zweite Build-Config zu pflegen,
  Overengineering für den jetzigen Stand.
- **`peerDependencies` für CM6:** korrekter Weg für ein breit veröffentlichtes
  npm-Paket, aber für den jetzigen Zweck (Import in ein Projekt ohne eigenes
  CM6) nur zusätzlicher Setup-Aufwand ohne realen Nutzen. Umstellung später ist
  eine reine `package.json`-Änderung, falls „state instances incompatible"
  auftritt. YAGNI.

## Änderungen im Detail

### 1. `package.json`

- **`prepare`-Script hinzufügen:** `"prepare": "npm run build"`.
  Nutzt das bestehende, bewährte Build-Script
  (`vite build && tsc --emitDeclarationOnly`).
- **Toten CSS-Export entfernen:** `exports["./dist/supamde.css"]` streichen.
- **`files` auf `["dist/**/*"]` reduzieren** (bisher zusätzlich `src/**/*`).
  Irrelevant für Git-Install, aber korrekt für späteren npm-Publish.
- **`version` von `0.0.0` auf `0.1.0`** — Startpunkt „installierbar, im Aufbau".

Ziel-`exports`:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/supamde.mjs",
    "require": "./dist/supamde.js"
  }
}
```

Verifiziert: Die Pfade `dist/supamde.mjs`, `dist/supamde.js`, `dist/index.d.ts`
entsprechen der realen Build-Ausgabe (Vite `formats: ['es','umd']`,
tsc `outDir: dist`).

### 2. README

Installationsabschnitt ergänzen: Git-Install als aktuell gültiger Weg, npm-Weg
als „später"-Ausblick beibehalten. Hinweis „CM6 ist mitgebündelt" bleibt.

```
## Installation

Aktuell (direkt aus dem Repo):

    npm install git+https://github.com/svenho/SupaMDE.git

Später als npm-Paket:

    npm install supamde

CodeMirror 6 ist mitgebündelt — es muss nicht separat installiert werden.
```

## Verifikation

**Reihenfolge-Abhängigkeit:** Der E2E-Git-Install-Test (2b) zieht den nach
GitHub **gepushten** Stand. Daher: Änderungen → 2a lokal grün → commit → push →
2b gegen GitHub.

### 2a. Lokaler Pack-Test (kein Netz nötig)

```bash
npm pack --dry-run   # zeigt, welche Dateien ins Paket wandern
npm pack             # erzeugt supamde-0.1.0.tgz, triggert prepare (baut dist/)
```

Prüfkriterien:
- `prepare` läuft und baut `dist/`.
- Tarball enthält `dist/supamde.mjs`, `dist/supamde.js`, `dist/index.d.ts`.
- Tarball enthält **kein** `src/`.
- Kein Fehler durch fehlende CSS-Datei.

### 2b. End-to-End-Git-Install (echter Pfad, gegen GitHub)

```bash
# in einem frischen Wegwerf-Ordner (Scratchpad):
npm init -y
npm install "git+https://github.com/svenho/SupaMDE.git"
```

Prüfkriterien:
- Klon → `prepare`-Build läuft im Zielprojekt durch.
- `node_modules/supamde/dist/` existiert.
- `import SupaMDE from 'supamde'` resolved ohne Fehler.

**Ehrliche Einschränkung:** Ob `npm install git+https://…` aus der
Ausführungsumgebung heraus tatsächlich läuft, hängt vom Netzwerkzugang ab. Ist
der Git-Fetch geblockt, wird 2a vollständig lokal verifiziert (deckt
`package.json`-Korrektheit und `prepare`-Build ab) und für 2b der exakte Befehl
zum Selbst-Ausführen bereitgestellt. Keine „getestet"-Behauptung ohne Beleg.

## Bewusst NICHT im Scope (YAGNI)

- Kein npm-Publish, kein `.npmignore`, kein CI/Release-Workflow.
- Kein `peerDependencies`-Umbau.
- Kein separater Dist-Build, kein Minify-/Sourcemap-Tuning.
- Keine Änderungen an `src/` oder der Build-Config.

## Zusammenfassung der realen Änderungen

1. `package.json`: `prepare`-Script rein, CSS-Export raus, `files` → nur `dist`,
   `version` → `0.1.0`.
2. README: Git-Install-Anleitung ergänzt.
3. Verifikation: `npm pack` lokal; danach commit → push → E2E-Git-Install-Test.
