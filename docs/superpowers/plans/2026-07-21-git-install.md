# Git-Installierbarkeit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SupaMDE aus einem anderen Projekt heraus per `npm install git+https://github.com/svenho/SupaMDE.git` installierbar und sofort nutzbar machen.

**Architecture:** `dist/` bleibt aus Git heraus (`.gitignore`). Ein `prepare`-Script baut bei jeder Installation (inkl. Git-Install) frisch über das bestehende `build`-Script. Toten CSS-Export entfernen, `files` und `version` bereinigen. Danach lokal per `npm pack` verifizieren, committen, pushen und E2E gegen GitHub testen.

**Tech Stack:** npm-Packaging (`prepare`-Lifecycle, `exports`, `files`), Vite-Library-Build + `tsc --emitDeclarationOnly` (unverändert), CodeMirror 6 als `dependencies`.

## Global Constraints

- Package-Name bleibt `supamde`. `gm-mini` ist ein anderes Modul und hier irrelevant.
- CodeMirror 6 bleibt als `dependencies` (kein `peerDependencies`-Umbau).
- Kein npm-Publish, kein `.npmignore`, kein CI/Release-Workflow, keine Änderungen an `src/` oder der Build-Config.
- Styling läuft über CM6-Themes zur Laufzeit; es gibt **keine** CSS-Datei und keinen CSS-Import für Konsumenten.
- Commit-vor-Push-Reihenfolge: E2E-Git-Install-Test (Task 3) zieht den nach GitHub gepushten Stand. Daher: `package.json`/README ändern → lokal `npm pack` grün → commit → push → E2E.
- Verifikation vor „fertig": keine „getestet"-Behauptung ohne Beleg. Ist der Git-Fetch in der Umgebung geblockt, wird Task 3 durch den exakten Befehl zum Selbst-Ausführen ersetzt und das transparent gemacht.

---

### Task 1: `package.json` für Packaging bereinigen

**Files:**
- Modify: `package.json` (Zeilen 3, 14-21, 22-25, 34-42)

**Interfaces:**
- Consumes: bestehendes `build`-Script (`vite build && tsc --project tsconfig.json --emitDeclarationOnly`).
- Produces: `prepare`-Script `npm run build`; bereinigte `exports` ohne CSS-Eintrag; `files: ["dist/**/*"]`; `version: "0.1.0"`.

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

- [ ] **Step 5: `package.json` auf gültiges JSON prüfen**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('JSON ok')"`
Expected: Ausgabe `JSON ok` (kein Parse-Fehler durch verrutschte Kommas).

- [ ] **Step 6: `prepare`/`build` laufen lassen und dist verifizieren**

Run: `npm run build`
Expected: Build läuft ohne Fehler durch; danach existieren `dist/supamde.mjs`, `dist/supamde.js`, `dist/index.d.ts`.

Verifikation:

Run: `ls dist/supamde.mjs dist/supamde.js dist/index.d.ts`
Expected: Alle drei Pfade werden aufgelistet, kein „No such file".

- [ ] **Step 7: Commit**

```bash
git add package.json
git commit -m "build: Package aus Git installierbar machen (prepare-Script, exports/files/version bereinigt)"
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

- [ ] **Step 5: Aufräumen**

Run: `rm -f supamde-0.1.0.tgz`
Expected: Tarball entfernt, kein Commit nötig (Verifikations-Task ohne Dateiänderung).

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

**Wenn der Git-Fetch in der Umgebung geblockt ist:** Diesen Task nicht als „bestanden" markieren. Stattdessen dem User den exakten Befehl zum Selbst-Ausführen geben und Task 2 (lokaler Pack-Test) als Beleg für die `package.json`-Korrektheit heranziehen.

- [ ] **Step 4: `dist/` im installierten Paket prüfen**

Run (im Wegwerf-Ordner): `ls node_modules/supamde/dist/supamde.mjs node_modules/supamde/dist/index.d.ts`
Expected: Beide Pfade werden aufgelistet — der `prepare`-Build ist im Zielprojekt gelaufen.

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
Expected: Zwei Installationszeilen im oberen Abschnitt (`git+https://…SupaMDE.git` und `supamde`) plus die bestehende `npm install`-Zeile im Entwicklungsabschnitt (ca. Zeile 130).

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
- Spec „ehrliche Einschränkung bei geblocktem Git-Fetch" → Task 3 Step 3 (Fallback) + Global Constraints. ✅
- Spec NICHT-im-Scope (kein Publish/peerDeps/src-Änderung) → Global Constraints. ✅

**2. Placeholder scan:** Keine TBD/TODO. Jeder Step enthält exakte Befehle, erwartete Ausgaben oder vollständige JSON-/Markdown-Blöcke. ✅

**3. Type consistency:** `prepare`-Script-Wert (`npm run build`), Dateipfade (`dist/supamde.mjs`, `dist/supamde.js`, `dist/index.d.ts`), Version (`0.1.0`) und der Import-Test (`typeof SupaMDE === 'function'`, deckt sich mit `export default SupaMDE` in `src/index.ts`) sind über alle Tasks konsistent. ✅
