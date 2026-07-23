# CM6 als Peer Dependency — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CM6/Lezer nicht mehr inline ins Bundle bauen, sondern als Peer Dependencies ausweisen; das Beispiel läuft über den Vite-Dev-Server aus `src`.

**Architecture:** Vite externalisiert alle `@codemirror/*`- und `@lezer/*`-Imports (RegExp-`external`), sodass sie als nackte Bare-Imports im ESM-Output stehen bleiben. package.json verschiebt diese Pakete nach `peerDependencies` und spiegelt sie in `devDependencies` (für lokalen Build/Test/Dev). Das UMD-Format entfällt (ESM-only). Keine API-Änderung an SupaMDE.

**Tech Stack:** Vite 8 (Library-Mode, Rollup), TypeScript 5.9, Vitest 4, CodeMirror 6 / Lezer.

## Global Constraints

- ESM-only: Vite baut ausschließlich `formats: ['es']`; kein UMD.
- Externalisiert werden **alle** CM6/Lezer-Pakete via RegExp `/^@(codemirror|lezer)\//`.
- Peer-Pakete (8): `@codemirror/view`, `@codemirror/state`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/lang-markdown`, `@lezer/highlight`, `@lezer/markdown`, `@lezer/common`.
- Peer-Version-Ranges bleiben exakt die aktuellen aus `dependencies` (`^6.43.6` etc.); `@lezer/common` neu mit `^1.2.3`.
- Dieselben 8 Pakete stehen zusätzlich in `devDependencies` (identische Ranges).
- `dependencies` wird leer und wird als Feld entfernt.
- CSS/Theme unangetastet: Der aktuelle `src`-Stand importiert **kein** CSS (Styling läuft über `EditorView.theme`); ein frischer Build erzeugt daher keine `supamde.css`. Eine evtl. noch im lokalen `dist` liegende `supamde.css` ist ein verwaistes Alt-Artefakt und wird durch den Clean-Build (Task 1) mit entfernt.
- `dist/` ist **git-ignoriert** (`.gitignore`) und wird nicht versioniert — der Build läuft beim Consumer über `"prepare": "npm run build"`. Kein `git add dist` in diesem Plan; alle dist-Operationen sind rein lokaler Build-Zustand.
- Keine Runtime-Injection-API, keine Import-Map, kein CDN.

---

## Datei-Übersicht

- Modify: `vite.config.ts` — UMD entfernen (`formats` + `fileName`), `rollupOptions.external` ergänzen.
- Modify: `package.json` — `dependencies` → `peerDependencies` + `devDependencies`, `@lezer/common` ergänzen.
- Modify: `example/index.html` — Import von `../dist/supamde.mjs` auf `../src/index.ts`.
- Modify: `README.md` — Einbindungs-/Peer-Hinweise und Build-Beschreibung.

Reihenfolge: erst Build-Config (Task 1), dann package.json (Task 2) — so lässt sich der externalisierte Build direkt gegen die neu installierten devDependencies verifizieren. Dann das Beispiel (Task 3), zuletzt die README (Task 4).

---

### Task 1: Vite-Build externalisieren (UMD raus, CM6/Lezer external)

**Files:**
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: ESM-Build `dist/supamde.mjs`, der `@codemirror/*`/`@lezer/*` **nicht** enthält, sondern als Bare-Imports stehen lässt. Kein `dist/supamde.js` (UMD) mehr.

- [ ] **Step 1: `formats` auf ESM-only setzen**

In `vite.config.ts`, im `build.lib`-Block, diese Zeile:

```typescript
      formats: ['es', 'umd'],
```

ersetzen durch:

```typescript
      formats: ['es'],
```

- [ ] **Step 2: `external` in `rollupOptions` ergänzen**

In `vite.config.ts` den `rollupOptions`-Block:

```typescript
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
```

ersetzen durch:

```typescript
    rollupOptions: {
      // CM6/Lezer sind Peer Dependencies — nicht ins Bundle ziehen.
      external: /^@(codemirror|lezer)\//,
      output: {
        exports: 'named',
      },
    },
```

- [ ] **Step 3: `fileName` auf ESM-only vereinfachen (toten UMD-Zweig entfernen)**

Ohne UMD-Format ist der `else`-Zweig der `fileName`-Funktion toter Code und verweist irreführend auf eine `supamde.js`, die es nicht mehr gibt. In `vite.config.ts`, im `build.lib`-Block, diese Zeile:

```typescript
      fileName: (format) => (format === 'es' ? 'supamde.mjs' : 'supamde.js'),
```

ersetzen durch:

```typescript
      fileName: () => 'supamde.mjs',
```

- [ ] **Step 4: Clean-Build ausführen und externalisierten Output verifizieren**

`dist/` vorab löschen (lokaler Build-Zustand, git-ignoriert), damit keine verwaisten Alt-Artefakte — UMD `supamde.js`, altes `supamde.css`, gelöschte Unterordner — die Verifikation verfälschen:

```bash
rm -rf dist && npm run build && ls -la dist/supamde.mjs dist/supamde.js dist/supamde.css 2>&1; echo "---"; grep -c "from \"@codemirror" dist/supamde.mjs
```

Expected:
- `dist/supamde.mjs` existiert und ist **klein** (wenige KB, nicht mehr ~616 KB).
- `dist/supamde.js` und `dist/supamde.css` existieren **nicht** (`ls`-Fehler „No such file" für diese beiden ist erwünscht).
- Der `grep -c` liefert eine Zahl `> 0` — die CM6-Imports stehen als Bare-Imports im Output.

- [ ] **Step 5: Commit**

`dist/` ist git-ignoriert und wird bewusst **nicht** committet — nur die Config-Änderung:

```bash
git add vite.config.ts
git commit -m "build: CM6/Lezer externalisieren, UMD-Format entfernen"
```

---

### Task 2: package.json auf Peer Dependencies umstellen

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: die externalisierten Bare-Imports aus Task 1 (müssen zur Laufzeit/Buildzeit auflösbar sein).
- Produces: `peerDependencies` mit den 8 CM6/Lezer-Paketen; dieselben 8 in `devDependencies`; kein `dependencies`-Feld mehr.

- [ ] **Step 1: `dependencies` durch `peerDependencies` ersetzen und `@lezer/common` ergänzen**

In `package.json` den kompletten `dependencies`-Block:

```json
  "dependencies": {
    "@codemirror/commands": "^6.10.4",
    "@codemirror/lang-markdown": "^6.5.1",
    "@codemirror/language": "^6.12.4",
    "@codemirror/state": "^6.7.1",
    "@codemirror/view": "^6.43.6",
    "@lezer/highlight": "^1.2.3",
    "@lezer/markdown": "^1.7.2"
  }
```

ersetzen durch:

```json
  "peerDependencies": {
    "@codemirror/commands": "^6.10.4",
    "@codemirror/lang-markdown": "^6.5.1",
    "@codemirror/language": "^6.12.4",
    "@codemirror/state": "^6.7.1",
    "@codemirror/view": "^6.43.6",
    "@lezer/common": "^1.2.3",
    "@lezer/highlight": "^1.2.3",
    "@lezer/markdown": "^1.7.2"
  }
```

- [ ] **Step 2: Die 8 Pakete in `devDependencies` ergänzen**

In `package.json` den `devDependencies`-Block um die 8 CM6/Lezer-Pakete erweitern (alphabetisch einsortiert; die bestehenden Einträge bleiben). Der Block beginnt mit `"@codemirror/commands"` **vor** `"@eslint/js"`:

```json
  "devDependencies": {
    "@codemirror/commands": "^6.10.4",
    "@codemirror/lang-markdown": "^6.5.1",
    "@codemirror/language": "^6.12.4",
    "@codemirror/state": "^6.7.1",
    "@codemirror/view": "^6.43.6",
    "@eslint/js": "^10.0.1",
    "@lezer/common": "^1.2.3",
    "@lezer/highlight": "^1.2.3",
    "@lezer/markdown": "^1.7.2",
    "@types/node": "^22.20.1",
    "@vitest/coverage-v8": "^4.1.10",
    "eslint": "^10.7.0",
    "jsdom": "^29.1.1",
    "prettier": "^3.9.5",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.64.0",
    "vite": "^8.1.5",
    "vitest": "^4.1.10"
  }
```

- [ ] **Step 3: Lockfile aktualisieren und Auflösbarkeit sicherstellen**

Run:
```bash
npm install
```

Expected: Läuft ohne Fehler durch; kein `peer dep missing`-Warning für die 8 Pakete (sie sind über devDependencies vorhanden). `package-lock.json` wird aktualisiert.

- [ ] **Step 4: Typecheck und Tests grün**

Run:
```bash
npm run typecheck && npm run test:run
```

Expected: `typecheck` ohne Fehler; alle Vitest-Tests PASS (node_modules-Auflösung via devDependencies funktioniert unverändert).

- [ ] **Step 5: Build erneut verifizieren**

Run:
```bash
rm -rf dist && npm run build && test ! -f dist/supamde.js && echo "kein UMD ✓" && du -h dist/supamde.mjs
```

Expected: „kein UMD ✓" wird ausgegeben; `dist/supamde.mjs` ist klein (wenige KB). `dist/` bleibt uncommittet (git-ignoriert).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: CM6/Lezer als peerDependencies, @lezer/common ergaenzt"
```

---

### Task 3: Beispiel auf Vite-Dev-Server (Import aus src) umstellen

**Files:**
- Modify: `example/index.html`

**Interfaces:**
- Consumes: `src/index.ts` (Default-Export `SupaMDE`) — der Dev-Server löst dessen Bare-CM6-Imports aus node_modules auf.
- Produces: ein Beispiel, das über `npm run dev` im Browser lädt.

- [ ] **Step 1: Import-Quelle im Beispiel umstellen**

In `example/index.html` die Zeile:

```javascript
      import SupaMDE from '../dist/supamde.mjs';
```

ersetzen durch:

```javascript
      import SupaMDE from '../src/index.ts';
```

- [ ] **Step 2: Dev-Server starten und Auflösung prüfen**

Manuell (interaktiv):
```bash
npm run dev
```
Vite startet ohne Fehler und gibt eine lokale URL aus (z. B. `http://localhost:5173/`). Beim Öffnen von `/example/index.html` erscheint der Editor mit dem vorbefüllten Markdown; die Browser-Konsole zeigt die `SupaMDE-Version:`-Zeile ohne „Failed to resolve module"-Fehler für `@codemirror/*`.

Für den ausführenden Agent (kein Browser nötig) — Dev-Server im Hintergrund starten, per HTTP prüfen, dann gezielt beenden:
```bash
npm run dev > /tmp/supamde-dev.log 2>&1 &
DEV_PID=$!
# Vite kurz hochfahren lassen, dann die Beispielseite abrufen
sleep 3
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://localhost:5173/example/index.html
echo "--- Vite-Log (letzte Zeilen) ---"; tail -n 20 /tmp/supamde-dev.log
kill "$DEV_PID"
```

Expected:
- `curl` liefert `HTTP 200` für `example/index.html`.
- Das Vite-Log enthält die Ready-URL und **keinen** „Failed to resolve import"/„Failed to resolve module"-Fehler für `@codemirror/*` oder `@lezer/*`.
- Der Dev-Server-Prozess ist nach `kill` beendet.

> Hinweis: Der HTTP-200-Abruf der HTML-Seite belegt, dass Vite läuft; die eigentliche Bare-Import-Auflösung (`../src/index.ts` → `@codemirror/*`) zeigt sich im Log bzw. beim Modul-Request. Bleibt der Port 5173 belegt, nutzt Vite automatisch den nächsten freien Port — dann die URL aus dem Log übernehmen.

- [ ] **Step 3: Commit**

```bash
git add example/index.html
git commit -m "example: Beispiel aus src laden (Vite-Dev-Server statt dist)"
```

---

### Task 4: README auf Peer-Dependency-Modell aktualisieren

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: die in Task 2 festgelegten 8 Peer-Pakete + Ranges.
- Produces: eine README, die Konsumenten die Peer-Installation und die ESM-only-Ausgabe korrekt beschreibt.

- [ ] **Step 1: Installations-Abschnitt um Peer-Installation ergänzen**

In `README.md` diese Zeile (aktuell die einzige Peer-Aussage, ist falsch):

```markdown
CodeMirror 6 ist mitgebündelt — es muss nicht separat installiert werden.
```

ersetzen durch:

```markdown
### CodeMirror 6 als Peer Dependencies

SupaMDE bündelt CodeMirror 6 **nicht** mit — die CM6/Lezer-Pakete sind
Peer Dependencies und müssen im Projekt selbst installiert werden. So teilt
sich SupaMDE dieselbe CM6-Instanz wie dein übriger Code (npm dedupet über die
Version), und es entstehen keine doppelten oder inkompatiblen CM6-Kopien:

```bash
npm install \
  @codemirror/view @codemirror/state @codemirror/commands \
  @codemirror/language @codemirror/lang-markdown \
  @lezer/common @lezer/highlight @lezer/markdown
```

Die Einbindung erfolgt über einen Bundler (Vite, esbuild, Rollup, webpack …),
der die Bare-Imports auflöst. SupaMDE wird als ESM ausgeliefert.
```

- [ ] **Step 2: Build-Beschreibung im Entwicklung-Abschnitt korrigieren**

In `README.md` diese Zeile:

```markdown
npm run build      # Library-Build (ESM + UMD) + Typdeklarationen
```

ersetzen durch:

```markdown
npm run build      # Library-Build (ESM-only) + Typdeklarationen
```

- [ ] **Step 3: Prettier-Formatierung anwenden**

Run:
```bash
npm run format
```

Expected: läuft durch; `README.md` bleibt gültig formatiert (keine unerwarteten Änderungen an anderen Dateien außer ggf. Whitespace).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README auf CM6-Peer-Dependencies und ESM-only umgestellt"
```

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** vite.config (Task 1), package.json inkl. `@lezer/common` (Task 2), example (Task 3), README (Task 4), UMD-Entfernung (`formats` + `fileName`, Task 1), Verifikation `build`/`typecheck`/`test:run`/`dev` (Tasks 1–3) — alle Spec-Punkte haben eine Task.
- **Platzhalter:** keine — jeder Code-Step zeigt exakten Vorher/Nachher-Inhalt und exakte Befehle mit erwarteter Ausgabe.
- **Typ-/Namenskonsistenz:** Paketnamen und Version-Ranges sind über Tasks 2 und 4 identisch (die 8 Peers, `@lezer/common: ^1.2.3`); RegExp `/^@(codemirror|lezer)\//` konsistent mit den in package.json gelisteten Scopes.
- **Versions-Quelle (Wartbarkeit):** Die Version-Ranges stehen bewusst nur in `package.json` (peer + dev). Die README-Install-Zeile (Task 4) listet die Pakete **ohne** Ranges — so gibt es genau eine Versions-Quelle, und ein künftiger Range-Bump muss nur in `package.json` (an den zwei npm-bedingten Stellen peer/dev) nachgezogen werden, nicht in der Doku.
- **dist/git-Konsistenz:** `dist/` ist git-ignoriert; kein Task committet `dist`. dist-Operationen (`rm -rf dist`, Build) sind rein lokaler Build-Zustand zur Verifikation. Der Consumer baut über `"prepare": "npm run build"`.
- **CSS:** Der aktuelle `src`-Stand importiert kein CSS; ein Clean-Build erzeugt keine `supamde.css`. Eine im Alt-`dist` liegende `supamde.css` ist ein verwaistes Artefakt und durch `rm -rf dist` (Task 1) erledigt.
