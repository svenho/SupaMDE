# Git-Installierbarkeit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SupaMDE aus einem anderen Projekt heraus per `npm install git+https://github.com/svenho/SupaMDE.git` installierbar und sofort nutzbar machen.

**Architecture:** `dist/` bleibt aus Git heraus (`.gitignore`). Ein `prepare`-Script baut bei jeder Installation (inkl. Git-Install) frisch über das bestehende `build`-Script. Damit `prepare` im Zielprojekt durchläuft, muss npm beim Git-Install die `devDependencies` (Vite, TypeScript, ESLint-Kette) mitinstallieren — das ist der kritische Pfad und wird über einen Clean-Clone-Build (Task 2b) unabhängig vom Netz-Zugriff auf GitHub verifiziert. Toten CSS-Export entfernen, `files` und `version` bereinigen. Leere Test-Deklarationen (`dist/**/__tests__/*.test.d.ts`) über eine dedizierte `tsconfig.build.json` aus dem Deklarations-Build heraushalten; Sourcemaps bleiben bewusst im Paket (Debug-Nutzen beim Konsumenten). Danach lokal per `npm pack` verifizieren, committen, pushen und E2E gegen GitHub testen.

**Tech Stack:** npm-Packaging (`prepare`-Lifecycle, `exports`, `files`), Vite-Library-Build + `tsc --emitDeclarationOnly` (unverändert), CodeMirror 6 als `dependencies`.

## Global Constraints

- Package-Name bleibt `supamde`. `gm-mini` ist ein anderes Modul und hier irrelevant.
- CodeMirror 6 bleibt als `dependencies` (kein `peerDependencies`-Umbau).
- Kein npm-Publish, kein `.npmignore`, kein CI/Release-Workflow, keine Änderungen an `src/`. Die Build-Config wird gezielt erweitert (neue `tsconfig.build.json` + angepasstes `build`-Script), aber nicht umgebaut.
- Styling läuft über CM6-Themes zur Laufzeit; es gibt **keine** CSS-Datei und keinen CSS-Import für Konsumenten.
- `prepare` läuft beim Git-Install **im Zielprojekt** und braucht dort den Build-Toolchain aus `devDependencies`. Ein grüner lokaler `npm pack` (Task 2) belegt das **nicht**, weil lokal alle devDependencies bereits installiert sind. Der eigentliche Beleg ist der Clean-Clone-Build (Task 2b), der ohne vorinstallierte Umgebung baut.
- Sourcemaps (`dist/*.map`) und die Kern-`.d.ts` gehören ins Paket; leere Test-`.d.ts` nicht. Der Test-Ausschluss läuft über eine separate `tsconfig.build.json` — ein bloßes `exclude` in der bestehenden `tsconfig.json` greift **nicht**, weil die Tests transitiv über `import`-Ketten ins Programm gezogen werden (verifiziert).
- Commit-vor-Push-Reihenfolge: E2E-Git-Install-Test (Task 3) zieht den nach GitHub gepushten Stand. Daher: `package.json`/`tsconfig`/README ändern → lokal `npm pack` grün → Clean-Clone-Build grün → commit → push → E2E.
- Verifikation vor „fertig": keine „getestet"-Behauptung ohne Beleg. Ist der Git-Fetch in der Umgebung geblockt, wird Task 3 durch den exakten Befehl zum Selbst-Ausführen ersetzt und das transparent gemacht; der Clean-Clone-Build (Task 2b) bleibt als netz-unabhängiger Beleg der `prepare`-Kette bestehen.

---

### Task 1: `package.json` für Packaging bereinigen

**Files:**
- Modify: `package.json` (Zeilen 3, 14-21, 22-25, 34-42)
- Create: `tsconfig.build.json` (Deklarations-Build ohne Tests, ohne `vitest/globals`)

**Interfaces:**
- Consumes: bestehendes `build`-Script (`vite build && tsc --project tsconfig.json --emitDeclarationOnly`), bestehende `tsconfig.json` (per `extends` wiederverwendet).
- Produces: `prepare`-Script `npm run build`; `build`-Script nutzt `tsconfig.build.json` statt `tsconfig.json`; bereinigte `exports` ohne CSS-Eintrag; `files: ["dist/**/*"]`; `version: "0.1.0"`; keine `dist/**/__tests__/*.test.d.ts` mehr.

- [ ] **Step 1: Toten CSS-Export entfernen**

In `package.json` den `exports`-Block so ändern, dass der CSS-Eintrag entfällt. Vorher (Zeilen 14-21):

```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/supamde.mjs",
      "require": "./dist/supamde.js"
    },
    "./dist/supamde.css": "./dist/supamde.css"
  },
```

Nachher:

```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/supamde.mjs",
      "require": "./dist/supamde.js"
    }
  },
```

(Beachte: Das Komma nach `}` der `.`-Zeile entfällt, da kein weiterer Eintrag folgt.)

- [ ] **Step 2: `files` auf `dist` reduzieren**

Vorher (Zeilen 22-25):

```json
  "files": [
    "dist/**/*",
    "src/**/*"
  ],
```

Nachher:

```json
  "files": [
    "dist/**/*"
  ],
```

- [ ] **Step 3: `version` auf `0.1.0` setzen**

Zeile 3 von `"version": "0.0.0",` auf `"version": "0.1.0",` ändern.

- [ ] **Step 4: `prepare`-Script hinzufügen**

Im `scripts`-Block (nach `"format"`) einen `prepare`-Eintrag ergänzen. Vorher (Ende des Blocks):

```json
    "lint": "eslint .",
    "format": "prettier --write ."
  },
```

Nachher:

```json
    "lint": "eslint .",
    "format": "prettier --write .",
    "prepare": "npm run build"
  },
```

- [ ] **Step 5: Dedizierte `tsconfig.build.json` für den Deklarations-Build anlegen**

Die bestehende `tsconfig.json` zieht über `types: ["vitest/globals"]` und die `import`-Ketten die Testdateien mit ins Programm — ein `exclude` dort greift für die transitiv importierten Tests **nicht** (verifiziert: Test-`.d.ts` werden trotzdem emittiert). Deshalb eine separate Build-Config anlegen, die von der bestehenden erbt, aber Tests und `vitest/globals` herausnimmt.

Neue Datei `tsconfig.build.json` mit exakt diesem Inhalt:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": []
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "easy-markdown-editor", "src/**/__tests__/**"]
}
```

(`types: []` überschreibt das `["vitest/globals"]` der Basis, damit `tsc` ohne installiertes vitest keine `TS2688`-Typfehler wirft. Der `exclude`-Eintrag `src/**/__tests__/**` hält die Testdateien aus dem initialen Programm heraus, sodass sie auch nicht mehr transitiv emittiert werden.)

- [ ] **Step 6: `build`-Script auf `tsconfig.build.json` umstellen**

Im `scripts`-Block den `build`-Eintrag so ändern, dass der `tsc`-Aufruf die neue Build-Config nutzt. Vorher (Zeile 36):

```json
    "build": "vite build && tsc --project tsconfig.json --emitDeclarationOnly",
```

Nachher:

```json
    "build": "vite build && tsc --project tsconfig.build.json --emitDeclarationOnly",
```

(`typecheck` bleibt bewusst auf `tsconfig.json` — der Typecheck soll weiterhin die Tests mit abdecken; nur der ausgelieferte Deklarations-Build lässt sie weg.)

- [ ] **Step 7: `package.json` auf gültiges JSON prüfen**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('JSON ok')"`
Expected: Ausgabe `JSON ok` (kein Parse-Fehler durch verrutschte Kommas).

Und die neue Build-Config:

Run: `node -e "JSON.parse(require('fs').readFileSync('tsconfig.build.json','utf8')); console.log('tsconfig.build ok')"`
Expected: Ausgabe `tsconfig.build ok`.

- [ ] **Step 8: `prepare`/`build` laufen lassen und dist verifizieren**

Run: `rm -rf dist && npm run build`
Expected: Build läuft ohne Fehler durch; danach existieren `dist/supamde.mjs`, `dist/supamde.js`, `dist/index.d.ts`. (`rm -rf dist` vorweg stellt sicher, dass keine alten Test-`.d.ts` aus einem früheren Build stehen bleiben.)

Verifikation Kern-Dateien:

Run: `ls dist/supamde.mjs dist/supamde.js dist/index.d.ts`
Expected: Alle drei Pfade werden aufgelistet, kein „No such file".

Verifikation Test-`.d.ts` sind weg:

Run: `find dist -name "*.test.d.ts" | wc -l | tr -d ' '`
Expected: `0` (keine leeren Test-Deklarationen mehr im dist).

- [ ] **Step 9: Sicherstellen, dass `dist/` nicht versioniert ist**

Die gesamte `prepare`-Strategie setzt voraus, dass `dist/` nur zur Build-Zeit entsteht und **nicht** aus Git kommt (sonst würde ein Git-Install veraltete Artefakte ausliefern statt frisch zu bauen).

Run: `git ls-files dist/ | head`
Expected: **Leere** Ausgabe (kein einziger `dist/`-Pfad ist getrackt). Falls doch etwas erscheint: `git rm -r --cached dist/` und die `.gitignore`-Regel `dist/` prüfen, bevor es weitergeht.

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.build.json
git commit -m "build: Package aus Git installierbar machen (prepare-Script, exports/files/version bereinigt, Test-Typen aus Deklarations-Build)"
```

---

### Task 2: Lokaler Pack-Test (npm pack)

**Files:**
- Keine Änderungen — reiner Verifikations-Task auf Basis von Task 1.

**Interfaces:**
- Consumes: bereinigte `package.json` und `prepare`-Script aus Task 1.
- Produces: Bestätigung, dass der ausgelieferte Tarball die richtigen Dateien enthält (Beleg für „installierbar", ohne Netz).

- [ ] **Step 1: Trockenlauf — welche Dateien wandern ins Paket?**

Run: `npm pack --dry-run`
Expected: Die Ausgabe listet `dist/supamde.mjs`, `dist/supamde.js`, `dist/index.d.ts` (und weitere `dist/`-Dateien). Sie listet **kein** `src/`.

- [ ] **Step 2: Echtes Pack erzeugen (triggert prepare)**

Run: `npm pack`
Expected: `prepare` läuft (Build), am Ende wird `supamde-0.1.0.tgz` erzeugt.

- [ ] **Step 3: Tarball-Inhalt prüfen**

Run: `tar -tzf supamde-0.1.0.tgz | grep -E "package/dist/(supamde\.mjs|supamde\.js|index\.d\.ts)$"`
Expected: Drei Zeilen — `package/dist/supamde.mjs`, `package/dist/supamde.js`, `package/dist/index.d.ts`.

- [ ] **Step 4: Sicherstellen, dass kein `src/` ausgeliefert wird**

Run: `tar -tzf supamde-0.1.0.tgz | grep -c "package/src/" || true`
Expected: `0` (kein `src/` im Tarball).

- [ ] **Step 5: Sicherstellen, dass keine leeren Test-`.d.ts` ausgeliefert werden**

Run: `tar -tzf supamde-0.1.0.tgz | grep -c "\.test\.d\.ts$" || true`
Expected: `0` (die `tsconfig.build.json` aus Task 1 hält die Test-Deklarationen aus dem Paket).

- [ ] **Step 6: Aufräumen**

Run: `rm -f supamde-0.1.0.tgz`
Expected: Tarball entfernt, kein Commit nötig (Verifikations-Task ohne Dateiänderung).

---

### Task 2b: Clean-Clone-Build (netz-unabhängiger `prepare`-Beleg)

**Files:**
- Keine Änderungen — reiner Verifikations-Task in einem frischen Clone im Scratchpad.

**Interfaces:**
- Consumes: bereinigte `package.json`, `tsconfig.build.json` und `prepare`/`build`-Scripts aus Task 1 (aus dem **lokalen Arbeitsverzeichnis**, noch vor dem Push).
- Produces: Beleg, dass die `prepare`-Kette (`npm install` → `npm run build`) in einer **frischen** Umgebung ohne vorinstallierte `node_modules` durchläuft — genau der Pfad, den ein Git-Install im Zielprojekt nimmt, aber ohne Abhängigkeit vom GitHub-Netz-Fetch.

**Warum dieser Task:** Task 2 (`npm pack`) baut im Hauptprojekt, wo alle `devDependencies` längst installiert sind — er beweist also **nicht**, dass der Build in einer frischen Umgebung anläuft. Der teuerste Failure-Modus (Git-Install schlägt fehl, weil eine Build-Abhängigkeit im Zielprojekt fehlt) wird erst hier abgedeckt.

- [ ] **Step 1: Lokalen Stand in ein frisches Verzeichnis klonen**

```bash
CLONE=/private/tmp/claude-501/-Users-svenho-Projekte-SupaMDE/f9be635a-782e-4f46-8365-85c811fe82d2/scratchpad/clean-clone-build
rm -rf "$CLONE"
git clone /Users/svenho/Projekte/SupaMDE "$CLONE"
cd "$CLONE"
```

Expected: Clone erfolgreich. Da `dist/` in `.gitignore` steht, enthält der Clone **kein** `dist/` — der Build muss es erzeugen.

**Hinweis:** `git clone` überträgt nur committete Stände. Task 1 muss also committet (Task 1 Step 10), aber **noch nicht gepusht** sein — der lokale Clone zieht direkt aus dem Arbeits-Repo, nicht von GitHub.

- [ ] **Step 2: Frische Installation (baut über `prepare`)**

Run (im Clone): `npm install`
Expected: `npm install` installiert `dependencies` **und** `devDependencies` und führt danach `prepare` (= `npm run build`) aus. Läuft ohne Fehler durch. Dies ist die exakte Kette, die auch der Git-Install im Zielprojekt durchläuft.

- [ ] **Step 3: `dist/` aus dem frischen Build prüfen**

Run (im Clone): `ls dist/supamde.mjs dist/supamde.js dist/index.d.ts && find dist -name "*.test.d.ts" | wc -l | tr -d ' '`
Expected: Die drei Kern-Pfade werden aufgelistet, und die Test-`.d.ts`-Zählung ergibt `0` — der frische Build ist vollständig und sauber.

- [ ] **Step 4: Aufräumen**

Run: `rm -rf /private/tmp/claude-501/-Users-svenho-Projekte-SupaMDE/f9be635a-782e-4f46-8365-85c811fe82d2/scratchpad/clean-clone-build`
Expected: Clone entfernt. Kein Commit (Verifikation außerhalb des Repos).

---

### Task 3: End-to-End-Git-Install gegen GitHub

**Files:**
- Keine Änderungen im Repo — Verifikation in einem Wegwerf-Projekt im Scratchpad.

**Interfaces:**
- Consumes: nach GitHub gepushter Stand aus Task 1.
- Produces: Beleg, dass `npm install git+https://github.com/svenho/SupaMDE.git` in einem fremden Projekt durchläuft und der Import resolved.

**Voraussetzung:** Task 1 muss committet **und gepusht** sein, bevor dieser Task greift.

- [ ] **Step 1: Task-1-Commit nach GitHub pushen**

Run: `git push origin main`
Expected: Push erfolgreich; GitHub hat den bereinigten `package.json`-Stand.

- [ ] **Step 2: Frisches Wegwerf-Projekt anlegen**

```bash
rm -rf /private/tmp/claude-501/-Users-svenho-Projekte-SupaMDE/2881fa4b-e707-4570-9d51-35fc94f44324/scratchpad/git-install-test
mkdir -p /private/tmp/claude-501/-Users-svenho-Projekte-SupaMDE/2881fa4b-e707-4570-9d51-35fc94f44324/scratchpad/git-install-test
cd /private/tmp/claude-501/-Users-svenho-Projekte-SupaMDE/2881fa4b-e707-4570-9d51-35fc94f44324/scratchpad/git-install-test
npm init -y
```

Expected: `package.json` im Wegwerf-Ordner erzeugt.

- [ ] **Step 3: SupaMDE per Git installieren**

Run (im Wegwerf-Ordner): `npm install "git+https://github.com/svenho/SupaMDE.git"`
Expected: npm klont das Repo, führt `prepare` aus (Build läuft im Zielprojekt), Installation endet ohne Fehler.

**Wenn der Git-Fetch in der Umgebung geblockt ist:** Diesen Task nicht als „bestanden" markieren. Stattdessen dem User den exakten Befehl zum Selbst-Ausführen geben und als netz-unabhängigen Beleg **Task 2b (Clean-Clone-Build)** heranziehen — der deckt die vollständige `prepare`-Kette (`npm install` inkl. devDependencies → `npm run build`) in einer frischen Umgebung ab. Task 2 (lokaler Pack-Test) belegt zusätzlich nur die Tarball-Zusammensetzung, nicht die Build-Kette.

- [ ] **Step 4: `dist/` im installierten Paket prüfen**

Run (im Wegwerf-Ordner): `ls node_modules/supamde/dist/supamde.mjs node_modules/supamde/dist/index.d.ts && find node_modules/supamde/dist -name "*.test.d.ts" | wc -l | tr -d ' '`
Expected: Beide Kern-Pfade werden aufgelistet — der `prepare`-Build ist im Zielprojekt gelaufen — und die Test-`.d.ts`-Zählung ergibt `0`.

- [ ] **Step 5: Import auflösen**

```bash
# im Wegwerf-Ordner, package.json auf ESM setzen und Import testen:
node --input-type=module -e "import SupaMDE from 'supamde'; console.log('import ok:', typeof SupaMDE)"
```

Expected: Ausgabe `import ok: function` (der Default-Export ist die `SupaMDE`-Klasse).

- [ ] **Step 6: Aufräumen**

Run: `rm -rf /private/tmp/claude-501/-Users-svenho-Projekte-SupaMDE/2881fa4b-e707-4570-9d51-35fc94f44324/scratchpad/git-install-test`
Expected: Wegwerf-Ordner entfernt. Kein Commit (Verifikation außerhalb des Repos).

---

### Task 4: README um Git-Install-Anleitung ergänzen

**Files:**
- Modify: `README.md:10-16` (Installationsabschnitt)

**Interfaces:**
- Consumes: bestätigter Git-Install-Weg aus Task 3 (oder der bereitgestellte Selbst-Ausführen-Befehl).
- Produces: aktualisierter Installationsabschnitt mit Git-Weg als aktuell gültig und npm-Weg als Ausblick.

- [ ] **Step 1: Installationsabschnitt ersetzen**

Vorher (`README.md` Zeilen 10-16):

```markdown
## Installation

​```bash
npm install supamde
​```

CodeMirror 6 ist mitgebündelt — es muss nicht separat installiert werden.
```

Nachher:

```markdown
## Installation

Aktuell (direkt aus dem Repo):

​```bash
npm install git+https://github.com/svenho/SupaMDE.git
​```

Später als npm-Paket:

​```bash
npm install supamde
​```

CodeMirror 6 ist mitgebündelt — es muss nicht separat installiert werden.
```

(Die `​```bash`-Zäune ohne das Zero-Width-Zeichen schreiben — hier nur zur Darstellung eingefügt.)

- [ ] **Step 2: README-Konsistenz prüfen**

Run: `grep -n "npm install" README.md`
Expected: Zwei Installationszeilen im oberen Abschnitt (`git+https://…SupaMDE.git` und `supamde`) plus die bestehende `npm install`-Zeile im Entwicklungsabschnitt (aktuell Zeile 125). Die konkrete Zeilennummer kann durch die Ergänzung im oberen Abschnitt leicht abweichen — maßgeblich ist, dass genau diese drei Vorkommen erscheinen.

- [ ] **Step 3: Prettier über README laufen lassen**

Run: `npx prettier --check README.md`
Expected: `README.md` wird als formatiert gemeldet. Falls nicht: `npx prettier --write README.md` und erneut prüfen.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: Git-Installationsanleitung in README ergänzen"
```

- [ ] **Step 5: Push**

Run: `git push origin main`
Expected: README-Änderung auf GitHub sichtbar.

---

## Self-Review

**1. Spec coverage:**
- Spec „package.json: prepare-Script rein, CSS-Export raus, files → nur dist, version → 0.1.0" → Task 1 (Steps 1-4). ✅
- Spec „Verifikation 2a (npm pack lokal)" → Task 2. ✅
- Spec „Verifikation 2b (E2E-Git-Install), commit→push→Test-Reihenfolge" → Task 3 (Voraussetzung + Steps 1-5). ✅
- Spec „README: Git-Install-Anleitung ergänzt" → Task 4. ✅
- Spec „ehrliche Einschränkung bei geblocktem Git-Fetch" → Task 3 Step 3 (Fallback) + Task 2b + Global Constraints. ✅
- Spec NICHT-im-Scope (kein Publish/peerDeps/src-Änderung) → Global Constraints. ✅

**2. Placeholder scan:** Keine TBD/TODO. Jeder Step enthält exakte Befehle, erwartete Ausgaben oder vollständige JSON-/Markdown-Blöcke. ✅

**3. Type consistency:** `prepare`-Script-Wert (`npm run build`), Dateipfade (`dist/supamde.mjs`, `dist/supamde.js`, `dist/index.d.ts`), Version (`0.1.0`) und der Import-Test (`typeof SupaMDE === 'function'`, deckt sich mit `export default SupaMDE` in `src/index.ts`) sind über alle Tasks konsistent. ✅

**4. Robustheits-Ergänzungen (über die Ursprungs-Spec hinaus):**
- `prepare`/devDependencies-Kette im Zielprojekt wird durch **Task 2b (Clean-Clone-Build)** netz-unabhängig belegt — schließt die Lücke, dass ein grüner lokaler `npm pack` den Frisch-Build **nicht** beweist. ✅
- `dist/`-Versionierung: **Task 1 Step 9** (`git ls-files dist/`) macht die Kern-Annahme der `prepare`-Strategie prüfbar, statt sie nur zu behaupten. ✅
- dist-Sauberkeit: leere Test-`.d.ts` über dedizierte **`tsconfig.build.json`** (Task 1 Steps 5-6) ausgeschlossen — verifiziert, dass ein bloßes `exclude` in `tsconfig.json` **nicht** reicht (transitive Import-Emission). Sourcemaps bleiben bewusst im Paket. Gegenprobe in Task 1 Step 8, Task 2 Step 5, Task 2b Step 3 und Task 3 Step 4. ✅

**5. Build-Config-Konsistenz:** `build` nutzt `tsconfig.build.json` (ohne Tests, `types: []`), `typecheck` bleibt auf `tsconfig.json` (mit Tests). Beide erben von derselben Basis — keine doppelte Pflege der Compiler-Optionen. ✅
