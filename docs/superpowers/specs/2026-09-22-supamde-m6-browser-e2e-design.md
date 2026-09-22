# SupaMDE M6 — Browser-E2E-Tests

**Datum:** 2026-09-22
**Status:** Freigegeben (Design)
**Einordnung:** Meilenstein M6 aus dem
[Migrations-Design](2026-07-17-supamde-cm6-migration-design.md), Abschnitt 8.

---

## 1. Ziel & Rahmen

M6 gibt SupaMDE eine zweite Testebene: Tests, die in einem **echten Browser**
laufen und damit prüfen, was die bestehende jsdom-Suite prinzipbedingt nicht
prüfen kann — Layout, Scroll-Geometrie und die nativen Drag-&-Drop- und
Clipboard-APIs.

### 1.1 Warum diese Ebene fehlt

Die 568 bestehenden Tests laufen in jsdom. jsdom rendert nicht: es gibt kein
Layout, `scrollHeight` und `clientHeight` sind 0, `requestAnimationFrame` fehlt,
`DataTransfer.files` ist nicht befüllbar. Der Code kompensiert das an mehreren
Stellen mit Stubs, und die Testkommentare benennen die Lücke ausdrücklich:

- [`src/ui/__tests__/preview.test.ts:56`](../../../src/ui/__tests__/preview.test.ts) —
  „jsdom setzt scrollHeight/clientHeight auf 0, daher per defineProperty stubben"
- [`src/features/__tests__/upload-dom.test.ts:13`](../../../src/features/__tests__/upload-dom.test.ts) —
  „jsdom kennt den Konstruktor, aber `files` ist dort […]"
- [`src/editor/__tests__/link-click.test.ts:241`](../../../src/editor/__tests__/link-click.test.ts) —
  „`posAtCoords` ist in jsdom ohne echtes Layout unzuverlässig"

Ein Test, der seine eigenen Messwerte setzt, prüft die Messung nicht. Genau dort
lagen die letzten beiden Bugfixes vor diesem Meilenstein: `62a32cc`
(Klickhand-Extension liest Layout nicht im Update-Zyklus) und der
Fullscreen-Overflow aus `11e4f9d`. Beide wären von einer Browser-Suite gefangen
worden, von der jsdom-Suite nicht.

### 1.2 Scope-Festlegung gegenüber dem Migrations-Design

Der Fahrplan nennt für M6 fünf Punkte: generierte `.d.ts`, Cypress-E2E
portiert, Deprecation-Hinweise, README/Doku, `EasyMDE`-Alias-Entscheidung.
Davon bleibt für M6 **allein die E2E-Ebene**. Begründung je Punkt:

**Generierte `.d.ts` — bereits erledigt.** `npm run build` führt seit M0
`tsc --project tsconfig.build.json --emitDeclarationOnly` aus; `package.json`
verweist mit `types` auf `dist/index.d.ts`. Es gibt nichts zu bauen.

**Deprecation-Hinweise und `EasyMDE`-Alias — verschoben nach M7.** Beide Punkte
setzen voraus, dass SupaMDE easyMDE-Nutzer per Drop-in abholen will. M5 hat
diese Kompatibilität ausdrücklich aufgegeben
([M5-Design §1.1](2026-08-11-supamde-m5-features-design.md)). Die Punkte sind
damit nicht erledigt, sondern neu zu bewerten — zusammen mit der Frage, ob ein
dokumentierter Migrationspfad easyMDE→SupaMDE den Alias ersetzt. Das gehört in
denselben Meilenstein wie der README-Umbau.

**README/Doku — verschoben nach M7.** Die README ist auf 1107 Zeilen gewachsen
und nach Meilensteinen gegliedert („Optionen (Kern-Set, M1)", „API (M1)"); der
API-Abschnitt listet die seit M1 hinzugekommenen Methoden nicht. Der Umbau ist
eigenständige Arbeit ohne Bezug zur Testebene.

**Cypress — ersetzt durch Vitest Browser Mode.** Siehe §3.

### 1.3 Zweistufiger Schnitt

M6 zerfällt in zwei nacheinander auszuführende Teile:

- **M6a — Migration auf Vitest 5.** Rein mechanisch, kein neues Verhalten.
- **M6b — Browser-E2E-Suite.** Baut auf M6a auf.

Getrennt, weil ein roter Test dann eindeutig zuzuordnen ist. Zusammengeworfen
wäre bei jedem Fehlschlag offen, ob die Migration oder die neue Suite ihn
verursacht hat.

---

## 2. M6a — Migration auf Vitest 5

### 2.1 Warum die Migration Voraussetzung ist

Vitest 4 ist nicht der Weg zur Browser-Suite. Der Playwright-Provider ist seit
Vitest 4 ein **eigenes Paket** (`@vitest/browser-playwright`), und dieses Paket
existiert **erst ab 5.0** — seine `dist-tags` führen nur `beta`, `rc` und
`latest` (alle 5.x), keinen `V4`-Tag. Auf Vitest 4.1 bliebe nur der alte
String-Provider `provider: 'playwright'`, also genau die Form, die in 5
entfällt. Die Suite würde auf einer Schnittstelle entstehen, die beim nächsten
Upgrade vollständig anzufassen wäre.

### 2.2 Verifizierte Voraussetzungen

Geprüft am 2026-09-22 gegen den tatsächlichen Projektzustand:

| Anforderung von `vitest@5.0.1` | Projektstand | Ergebnis |
|---|---|---|
| Vite `^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0` | 8.1.5 | erfüllt |
| Node `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | 22.18.0 | erfüllt |

### 2.3 Betroffenheit durch Breaking Changes

| Breaking Change | Betroffenheit | Befund |
|---|---|---|
| Entfernte Entrypoints (`vitest/reporters`, `vitest/suite`, `vitest/snapshot`, …) | keine | Kein Testmodul importiert aus einem `vitest/*`-Unterpfad; alle nutzen `from 'vitest'`. `vitest/config` (in `vite.config.ts:1`) bleibt laut Migrationsguide bestehen. |
| `vi.clearAllMocks()` läuft jetzt vor jedem Test | keine | Kein modul-globales `vi.fn()` im Projekt — alle Mocks entstehen in `beforeEach` oder im Test selbst. Keine Mock-Historie wird über Testgrenzen getragen. |
| Coverage `include`/`exclude` matchen projektrelativ ohne `contains` | keine | `include: ['src/**/*.ts']` ist bereits projektrelativ formuliert. |
| Glob-Thresholds erben `perFile` nicht mehr | keine | Keine Thresholds konfiguriert. |
| jsdom: Zuweisungen an `globalThis`/`window` propagieren ins DOM | keine | Alle 16 `defineProperty`-Stubs hängen an **Instanzen** (`view.scrollDOM`, `panel.dom`, Event-Objekte), nicht an `globalThis` oder `window`. |

Das Risiko ist damit gering. 5.0.0 erschien am 2026-09-03, 5.0.1 am 2026-09-15 —
das Release ist jung. Fällt etwas auf, ist der Rückweg auf `4.1.11` offen, weil
M6a keine Testinhalte ändert.

### 2.4 Änderungen

1. `vitest` und `@vitest/coverage-v8` auf `^5.0.1`.
2. **`engines.node` von `^20.19.0 || ^22.13.0 || >=24` auf `^22.13.0 || >=24`.**
   Vitest 5 fordert Node `>=22.12`. Vitest ist zwar reine devDependency und
   bricht damit keinen Nutzer zur Laufzeit — aber der Git-Install führt über
   `prepare` einen `npm run build` aus und installiert dabei die
   devDependencies. Auf Node 20 liefe das in einen Engine-Konflikt. Die
   Untergrenze ehrlich anzuheben ist besser, als einen Install-Pfad zu
   dokumentieren, der nicht funktioniert.
3. `npm run test:run` muss **568 Tests in 45 Dateien grün** melden — unverändert.
   Kein Test wird für die Migration angepasst; wäre das nötig, ist die
   Betroffenheitsanalyse in §2.3 falsch und der Befund gehört ins Spec.

---

## 3. M6b — Runner-Wahl

**Vitest Browser Mode mit Playwright-Provider**, nicht Cypress und nicht
Playwright Test.

Das Migrations-Design nannte Cypress, weil easyMDE es nutzt. Diese Begründung
trägt nicht mehr: SupaMDE übernimmt keinen easyMDE-Testcode (die Innenseite ist
vollständig neu gebaut), es bliebe allein das Fall-Inventar — und das ist
runner-unabhängig.

Gegen einen zweiten Runner (Cypress oder Playwright Test) spricht, dass er eine
zweite Testwelt ins Repo bringt: eigene Konfiguration, eigenes
Assertion-Framework, eigenes `tsconfig`. Vitest Browser Mode nutzt dieselbe
Syntax, dieselbe Konfigurationsdatei und dieselben Assertions wie die
bestehenden 45 Testdateien.

Der Preis ist ehrlich zu nennen: Browser Mode ist jünger als Playwright Test und
bietet weniger E2E-Komfort — kein Trace-Viewer, schwächeres Retry- und
Report-Ökosystem. Für drei fokussierte Testdateien gegen den eigenen Code wiegt
die Einheitlichkeit schwerer als der fehlende Komfort. Sollte sich das drehen,
ist der Wechsel möglich, ohne die Testinhalte neu zu denken.

**Browser: nur Chromium.** Die drei Bereiche prüfen die Mechanik des eigenen
Codes, nicht die Kompatibilität zwischen Engines. Ein Binary (~150 MB) genügt;
Firefox und WebKit können additiv dazukommen, wenn ein konkreter Befund es
rechtfertigt.

**Testziel: die Quellen.** Die Tests importieren aus `src/index.ts`, wie die
Unit-Tests und wie `example/index.html`. Kein Build-Schritt vor dem Testlauf,
Stacktraces zeigen auf echte Quellzeilen. Ob das gebaute Bundle selbst intakt
ist (externals, CSS-Extraktion), ist eine andere Frage — ein Release-Smoke-Test,
der zu M7 gehört.

---

## 4. M6b — Konfiguration & Struktur

`vite.config.ts` erhält `test.projects` mit zwei Einträgen. Die bestehende
Konfiguration wandert **unverändert** in das Projekt `unit`:

```ts
import { playwright } from '@vitest/browser-playwright';

test: {
  projects: [
    {
      extends: true,
      test: {
        name: 'unit',
        environment: 'jsdom',
        include: ['src/**/__tests__/**/*.test.ts'],
        css: true,
        globals: true,
      },
    },
    {
      extends: true,
      test: {
        name: 'browser',
        include: ['test/browser/**/*.test.ts'],
        browser: {
          enabled: true,
          headless: true,
          provider: playwright(),
          instances: [{ browser: 'chromium' }],
        },
      },
    },
  ],
}
```

Zwei Details der Vitest-4/5-API, gegen die Dokumentation geprüft: der Provider
wird als **Funktionsaufruf** `playwright()` übergeben (nicht als String), und
`headless` gehört auf die `browser`-Ebene, nicht in den Instanz-Eintrag.

**Ablageort `test/browser/` — bewusst außerhalb von `src/`.** Damit greifen
weder `tsconfig.build.json` (zieht `src/**/*.ts` in die `.d.ts`-Generierung)
noch die Coverage-Konfiguration (`include: ['src/**/*.ts']`) auf die
Browser-Tests zu. Die Unit-Tests liegen weiterhin in `src/**/__tests__/`; diese
Struktur bleibt unangetastet.

### 4.1 Skripte

| Skript | Läuft |
|---|---|
| `test`, `test:run` | nur `unit` (`--project unit`) — schnell, ohne Browser |
| `test:browser` | nur `browser` |
| `test:all` | beide Projekte |

Der schnelle, browserfreie Standardlauf bleibt erhalten. Wer nur an der Logik
arbeitet, braucht kein Browser-Binary.

### 4.2 Neue Abhängigkeiten

`@vitest/browser`, `@vitest/browser-playwright`, `playwright` als
devDependencies, dazu das Chromium-Binary über `npx playwright install
chromium` (~150 MB, außerhalb von `node_modules`).

Die Installation erfolgt **erst nach ausdrücklicher Zustimmung** des
Auftraggebers, einschließlich des Browser-Binaries.

---

## 5. M6b — Testinhalte

Leitprinzip: **Jeder Browser-Test muss etwas prüfen, das der jsdom-Test
prinzipiell nicht kann.** Ein Test, der auch in jsdom liefe, gehört in die
Unit-Suite — sonst zahlt die Browser-Ebene Laufzeit für Redundanz.

### 5.1 `test/browser/layout.test.ts` — Layout & Fullscreen

- Fullscreen spannt den Container auf Viewport-Größe (`getBoundingClientRect()`
  gegen `window.innerWidth`/`innerHeight`).
- **Die Höhenkette hält.** Bei einem Dokument, das länger als der Viewport ist,
  wächst die Editor-Zeile nicht über den Viewport hinaus, sondern scrollt innen:
  Container-Höhe bleibt gleich Viewport-Höhe, und `.cm-scroller` hat
  `scrollHeight > clientHeight`. Das sind die drei ineinandergreifenden
  Flex-Regeln aus [`src/ui/fullscreen.css`](../../../src/ui/fullscreen.css) und
  die Regression aus `11e4f9d`.
- Side-by-Side teilt die Editor-Zeile tatsächlich etwa 50/50 (gemessene
  Breiten, nicht CSS-Klassen).
- Escape verlässt Fullscreen und stellt `document.body.style.overflow` auf den
  Ausgangswert zurück.

### 5.2 `test/browser/scroll-sync.test.ts` — Scroll-Sync

- Editor-Scroll zieht die Vorschau mit, bei **echten** Scroll-Höhen. Ersetzt die
  vier `defineProperty`-Stubs aus
  [`preview.test.ts:57-70`](../../../src/ui/__tests__/preview.test.ts).
- Gegenrichtung: Vorschau-Scroll zieht den Editor mit.
- **Der rAF-Guard.** Kein Aufschaukeln zwischen den Panes, und ein echter
  Nutzer-Scroll unmittelbar nach einem programmatischen wird **nicht**
  verschluckt. Genau dafür existiert `scheduleGuardReset` in
  [`src/ui/preview.ts:50-66`](../../../src/ui/preview.ts); in jsdom greift
  mangels `requestAnimationFrame` nur der synchrone Fallback-Zweig, der echte
  Pfad bleibt dort ungetestet.
- Randfall `denom === 0` (Dokument kürzer als der Viewport): kein NaN, kein
  Sprung.

### 5.3 `test/browser/upload.test.ts` — Drag & Drop / Paste

- **Dateiauswahl** über `userEvent.upload()`: Platzhalter erscheint und wird
  nach aufgelöstem Upload durch die Bild-Syntax ersetzt.
- **Positionsstabilität.** Während der Upload läuft, wird *vor* der
  Platzhalterstelle Text eingefügt; die Ersetzung landet trotzdem an der
  richtigen Stelle. Das ist der Daseinszweck des `StateField` in
  [`src/features/upload-placeholder.ts`](../../../src/features/upload-placeholder.ts).
- **Fehlerfall.** Ein abgelehnter Upload ersetzt den Platzhalter durch den
  Fehlertext.
- **Paste** aus der Zwischenablage mit echtem `ClipboardEvent`.

**Bekannte Grenze, bewusst benannt:** `userEvent.dragAndDrop()` zieht ein
*Element* auf ein Ziel — es lässt keine *Datei* aus dem Betriebssystem fallen.
Echtes Datei-Drop ist im Browser nur über einen konstruierten `DataTransfer` mit
`dispatchEvent` erreichbar. Das bleibt deutlich näher an der Realität als jsdom
(echte `File`- und `DataTransfer`-Implementierung statt Nachbau), ist aber kein
nativer Betriebssystem-Drop. Der Dateiauswahl-Pfad über `userEvent.upload()` ist
dagegen vollständig echt. Beide Pfade werden abgedeckt; die Grenze wird nicht
kaschiert.

---

## 6. M6b — Test-Helfer

`test/browser/helpers.ts`, schlank und eigenständig. Der bestehende
[`src/__tests__/helpers.ts`](../../../src/__tests__/helpers.ts) wird **nicht**
wiederverwendet: er baut `EditorState`/`EditorView` ohne Layout und ist auf die
Unit-Ebene zugeschnitten.

- **`mountEditor(options)`** — hängt eine Textarea an `document.body`, baut
  `new SupaMDE({ element, ...options })`, liefert Instanz und Aufräumfunktion.
  Der Konstruktor ist dafür selbstgenügsam: eine Textarea genügt, es gibt keine
  Framework-Bindung.
- **`afterEach`-Aufräumen** — zerstört die Instanz und leert den Body.
  Zwingend, nicht optional: `fullscreenCount` in
  [`src/ui/fullscreen.ts:22`](../../../src/ui/fullscreen.ts) ist **modulweiter**
  Zustand. Stirbt eine Instanz im Fullscreen, bleibt der Zähler stehen und
  `document.body.style.overflow` gesperrt — der nächste Test liefe auf einem
  verfälschten Ausgangszustand.
- **Dokument-Generator** für „lang genug zum Scrollen", damit die Scroll-Tests
  nicht an einer Magic-String-Konstante hängen.

---

## 7. Abnahmekriterien

1. `npm run test:run` meldet 568 Tests in 45 Dateien grün — **unverändert**
   gegenüber dem Stand vor M6.
2. `npm run test:browser` läuft in Chromium grün.
3. `npm run test:all` läuft beide Projekte grün.
4. `npm run build`, `npm run typecheck` und `npm run lint` bleiben grün;
   `test/browser/**` fließt nicht in `dist/` ein.
5. Jeder Browser-Test prüft nachweislich etwas, das in jsdom nicht prüfbar ist
   (§5, Leitprinzip).

---

## 8. Bewusste Grenzen (YAGNI)

- **Kein Cross-Browser-Testing.** Nur Chromium. Firefox und WebKit erst, wenn
  ein konkreter Befund sie rechtfertigt.
- **Keine visuelle Regression** (Screenshot-Vergleiche). Vitest 5 böte das an;
  es bringt Referenzbilder, Plattformabhängigkeit und Flake mit — für die drei
  gewählten Bereiche prüfen gemessene Werte präziser als Pixelvergleiche.
- **Keine Tastenkürzel-Tests im Browser.** Unit-getestet und dort ausreichend
  abgedeckt; im Browser käme vor allem die Kollision mit Browser-Eigenkürzeln
  dazu — eine andere Frage als die drei gewählten Bereiche.
- **Keine Tests gegen `dist/`.** Der Release-Smoke-Test gehört zu M7.
- **Keine Portierung von easyMDE-Cypress-Code.** Das Fall-Inventar dient als
  Referenz, der Code nicht als Vorlage.
- **Keine Änderung an den 568 bestehenden Tests.** Die jsdom-Stubs bleiben, wo
  sie sind: sie testen die Logik, die Browser-Suite testet die Mechanik. Erst
  wenn sich ein Stub als *falsch* erweist (nicht nur als unvollständig), wird er
  angefasst — und dann als eigener Befund.
- **Kein CI-Setup.** Das Repo hat derzeit keine CI-Konfiguration; eine
  einzuführen ist eigene Arbeit und nicht Teil dieses Meilensteins.
