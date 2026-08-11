# Fullscreen-Overflow-Bug und Kleinbefunde — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Bestandsbug beheben, bei dem zwei gleichzeitige SupaMDE-Instanzen den
body-Scroll dauerhaft sperren, und drei Kleinbefunde aus der Review des
Vorschau-Vollbild-Buttons aufräumen.

**Architecture:** Der Overflow-Bug wird über einen modulweiten Zähler aktiver
Vollbild-Instanzen gelöst: Nur die erste Instanz sichert den ursprünglichen
`body.style.overflow`, nur die letzte stellt ihn wieder her. Der Zähler lebt im
Modulscope von `fullscreen.ts` — kein neuer globaler Zustand, kein neues Modul, keine
API-Änderung. Die übrigen drei Tasks sind reine Text-Korrekturen ohne Verhaltensänderung.

**Tech Stack:** TypeScript 5.9, CodeMirror 6, Vitest (jsdom), ESLint/Prettier.

## Global Constraints

- Sprache im Code: Kommentare und Doc-Kommentare auf Deutsch, wie im gesamten Repo.
  Umlaute korrekt (`ü`, `ö`, `ä`, `ß`), keine ASCII-Ersatzschreibweisen.
- Testframework: Vitest. Einzelne Datei laufen lassen mit `npx vitest run <pfad>`, alles
  mit `npm run test:run`.
- Typecheck: `npm run typecheck`. Lint: `npm run lint`.
- Es gibt **kein** CHANGELOG.md im Repo. Dokumentiert wird ausschließlich in `README.md`.
- Die öffentliche API bleibt in allen vier Tasks unverändert: keine neuen Methoden, keine
  geänderten Signaturen, keine geänderten Interfaces. `Fullscreen` behält exakt
  `toggle` / `set` / `isActive` / `destroy`.
- `npx prettier --check README.md` schlägt im Repo **bereits vorbestehend** fehl (schon vor
  dem Vorschau-Vollbild-Branch). Das ist **nicht** Gegenstand dieses Plans. Task 3 ändert
  README-Zeilen; dabei gilt: die berührten Zeilen an Prettiers Zielformat angleichen, aber
  **kein** `prettier --write README.md` über die ganze Datei laufen lassen — das würde den
  Diff mit über hundert unbezogenen Zeilen aufblähen.
- Reihenfolge: Task 1 ist der einzige Task mit Verhaltensänderung und steht zuerst. Die
  Tasks 2–4 sind voneinander unabhängig und berühren getrennte Dateien.

---

### Task 1: body-Scroll bei mehreren Instanzen korrekt wiederherstellen

**Der Bug:** `createFullscreen` sichert den vorherigen `document.body.style.overflow` in
einer instanz-lokalen Variable `savedOverflow` (`src/ui/fullscreen.ts:20`). Bei zwei
Editoren auf einer Seite überschreiben sich die Snapshots:

1. Instanz A geht ins Vollbild → sichert `''` (den echten Ausgangswert), setzt `'hidden'`.
2. Instanz B geht ins Vollbild → sichert `'hidden'` (den von A gesetzten Wert!), setzt `'hidden'`.
3. Instanz A verlässt das Vollbild → schreibt `''` zurück, obwohl B noch im Vollbild ist.
   Die Seite scrollt jetzt hinter dem Vollbild von B.
4. Instanz B verlässt das Vollbild → schreibt `'hidden'` zurück. **Der body bleibt dauerhaft
   scroll-gesperrt, obwohl keine Instanz mehr im Vollbild ist.**

Schritt 4 ist der eigentliche Schaden: ein Zustand, aus dem der Nutzer ohne Reload nicht
mehr herauskommt.

**Die Lösung:** Ein modulweiter Zähler `activeCount` plus ein modulweiter Snapshot
`savedOverflow`. Beim Übergang 0 → 1 wird gesichert und gesperrt; beim Übergang 1 → 0
wird wiederhergestellt. Dazwischen passiert nichts. Der Zähler ersetzt die instanz-lokale
Variable vollständig.

**Files:**
- Modify: `src/ui/fullscreen.ts` (Modulscope-Variablen, `set`-Funktion)
- Test: `src/ui/__tests__/fullscreen.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: keine API-Änderung. `createFullscreen` behält Signatur und Rückgabetyp. Die
  Änderung ist rein intern.

- [ ] **Step 1: Failing Test für zwei parallele Instanzen schreiben**

Ans Ende des `describe('createFullscreen', …)`-Blocks in `src/ui/__tests__/fullscreen.test.ts`
einfügen. Der Helfer zum Erzeugen eines Containers heißt in dieser Datei `container()`:

```ts
  it('stellt body-overflow bei zwei parallelen Instanzen korrekt wieder her', () => {
    document.body.style.overflow = 'scroll';
    const a = createFullscreen(container());
    const b = createFullscreen(container());

    a.set(true);
    expect(document.body.style.overflow).toBe('hidden');

    // Zweite Instanz ins Vollbild: darf den bereits gesperrten Wert NICHT als
    // vermeintlichen Ausgangszustand sichern.
    b.set(true);
    expect(document.body.style.overflow).toBe('hidden');

    // Erste Instanz verlässt das Vollbild, zweite ist noch aktiv: bleibt gesperrt.
    a.set(false);
    expect(document.body.style.overflow).toBe('hidden');

    // Letzte Instanz verlässt das Vollbild: echter Ausgangswert kehrt zurück.
    b.set(false);
    expect(document.body.style.overflow).toBe('scroll');

    a.destroy();
    b.destroy();
    document.body.style.overflow = '';
  });

  it('stellt body-overflow auch bei destroy() aus dem Vollbild wieder her', () => {
    document.body.style.overflow = 'scroll';
    const a = createFullscreen(container());
    const b = createFullscreen(container());

    a.set(true);
    b.set(true);
    a.destroy();
    expect(document.body.style.overflow).toBe('hidden');

    b.destroy();
    expect(document.body.style.overflow).toBe('scroll');

    document.body.style.overflow = '';
  });
```

Hinweis zur Testhygiene: Die Datei hat **kein** `beforeEach`/`afterEach` — jeder Test
räumt selbst auf. Deshalb setzen die beiden neuen Tests `overflow` am Ende explizit
zurück. Der Ausgangswert `'scroll'` ist bewusst gewählt, weil er sich vom Default und vom
`'auto'` des Bestandstests bei Zeile 24–33 unterscheidet; so schlägt der Test auch dann
zu, wenn ein fremder Wert durchsickert.

Zwei Dinge, die beim Umbau leicht kaputtgehen: Erstens muss jeder Test, der eine Instanz
ins Vollbild schickt, sie auch wieder verlassen oder `destroy()` rufen — sonst bleibt
`fullscreenCount` erhöht und alle folgenden Tests sehen einen gesperrten body. Der
Bestandstest bei Zeile 24–33 ist in dieser Hinsicht in Ordnung (er ruft `toggle()`
paarweise). Zweitens hinterlässt genau dieser Bestandstest `overflow` auf `'auto'`, ohne
aufzuräumen — die neuen Tests setzen ihren Ausgangswert deshalb selbst und dürfen sich
nicht auf einen leeren Startwert verlassen.

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/ui/__tests__/fullscreen.test.ts`
Expected: FAIL — der erste Test scheitert an der letzten Zusicherung mit
`expected 'hidden' to be 'scroll'` (der body bleibt gesperrt).

- [ ] **Step 3: Zähler im Modulscope einführen**

In `src/ui/fullscreen.ts` **oberhalb** von `export function createFullscreen` einfügen
(nach dem Doc-Kommentar-Block des Moduls, vor der Funktion):

```ts
/**
 * Modulweiter Zustand für die body-Scroll-Sperre. Bewusst nicht instanz-lokal:
 * Mehrere Editoren teilen sich einen `document.body`. Würde jede Instanz ihren
 * eigenen Snapshot halten, sicherte die zweite Instanz den bereits gesperrten
 * Wert `'hidden'` als vermeintlichen Ausgangszustand — und schriebe ihn beim
 * Verlassen zurück. Der body bliebe dauerhaft gesperrt.
 *
 * Nur der Übergang 0 → 1 sichert und sperrt, nur 1 → 0 stellt wieder her.
 */
let fullscreenCount = 0;
let savedBodyOverflow = '';
```

- [ ] **Step 4: `set` auf den Zähler umstellen**

In `src/ui/fullscreen.ts` die instanz-lokale Zeile `let savedOverflow = '';` (Zeile 20)
**ersatzlos löschen** und den Rumpf von `set` ersetzen:

```ts
  const set = (next: boolean): void => {
    if (next === active) return;
    active = next;
    container.classList.toggle('supamde-fullscreen', active);
    if (active) {
      // Erst die Instanz, die die Sperre auslöst, sichert den Ausgangswert.
      if (fullscreenCount === 0) savedBodyOverflow = document.body.style.overflow;
      fullscreenCount += 1;
      document.body.style.overflow = 'hidden';
    } else {
      fullscreenCount = Math.max(0, fullscreenCount - 1);
      // Erst wenn keine Instanz mehr im Vollbild ist, kehrt der Ausgangswert zurück.
      if (fullscreenCount === 0) document.body.style.overflow = savedBodyOverflow;
    }
    opts.onToggleFullScreen?.(active);
  };
```

Warum `Math.max(0, …)`: Der Zähler darf nicht negativ werden, falls eine Instanz durch
einen Fehlerpfad doppelt deaktiviert wird. Ein negativer Zähler würde die nächste
Sperre nie wieder aufheben — dieselbe Bug-Klasse, nur andersherum.

`destroy` bleibt **unverändert**: Es ruft bereits `if (active) set(false)` und läuft damit
automatisch über den Zähler.

- [ ] **Step 5: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/ui/__tests__/fullscreen.test.ts`
Expected: PASS — alle Tests der Datei, auch die bestehenden Einzel-Instanz-Tests.

Sollte ein **bestehender** Test fehlschlagen, weil er den alten instanz-lokalen Snapshot
voraussetzte: Prüfe, ob er zwischen den Testfällen aufräumt. Testreihenfolge-Abhängigkeit
über `fullscreenCount` ist ein echtes Risiko dieses Umbaus — jeder Test, der eine Instanz
im Vollbild zurücklässt, ohne `destroy()` zu rufen, verfälscht den Zähler für alle
folgenden. Melde einen solchen Fund, statt ihn stillschweigend zu umgehen.

- [ ] **Step 6: Gesamte Suite laufen lassen**

Run: `npm run test:run`
Expected: PASS. Diese Task ändert modulweiten Zustand — der Gesamtlauf ist hier nicht
optional, weil er Testreihenfolge-Effekte sichtbar macht, die ein Einzeldateilauf verdeckt.

- [ ] **Step 7: Typecheck und Lint**

Run: `npm run typecheck && npm run lint`
Expected: keine Fehler

- [ ] **Step 8: Commit**

```bash
git add src/ui/fullscreen.ts src/ui/__tests__/fullscreen.test.ts
git commit -m "fix(ui): body-Scroll bei mehreren Vollbild-Instanzen korrekt wiederherstellen"
```

---

### Task 2: Warntext des SupaLike-Wächters vervollständigen

**Der Befund:** Der Warntext in `src/ui/toolbar.ts:146-151` nennt als betroffene
view-Buttons nur `side-by-side/fullscreen`. Seit der Einführung von `preview-fullscreen`
ist die Meldung unvollständig: Wer ein Fremdobjekt an `createToolbar` übergibt und den
Kombi-Button konfiguriert, bekommt eine Warnung, die den tatsächlich betroffenen Button
nicht erwähnt. Rein diagnostisch, kein Verhaltensfehler.

**Wichtig — was hier NICHT geändert wird:** Der Wächter `isSupaLike()` selbst
(`src/ui/toolbar.ts:32-40`) prüft bewusst nur die vier ursprünglichen Methoden. Nimmt man
die zwei neuen mit auf, fallen Host-Objekte, die nur die alten vier implementieren, durch
die Prüfung — die Toolbar verlöre für sie den Aktiv-Zustand aller view-Buttons. Diese
Entscheidung steht so im Vorgänger-Plan und bleibt bestehen. Diese Task ändert
**ausschließlich Kommentar- und Meldungstext**, keine Logik.

**Files:**
- Modify: `src/ui/toolbar.ts` (Doc-Kommentar Zeile 28-31, Warntext Zeile 146-151, Kommentar Zeile 131)

**Interfaces:**
- Consumes: nichts
- Produces: nichts (reine Textänderung)

- [ ] **Step 1: Warntext anpassen**

In `src/ui/toolbar.ts` den `console.warn`-Aufruf ersetzen:

```ts
        console.warn(
          'SupaMDE: Toolbar enthält view-Buttons (preview-fullscreen/side-by-side/' +
            'fullscreen/editor-mode), aber die übergebene Editor-Instanz erfüllt ' +
            'SupaLike nicht (toggleSideBySide/toggleFullScreen/isSideBySideActive/' +
            'isFullscreenActive) — Aktiv-Zustand dieser Buttons wird nicht aktualisiert.',
        );
```

Die Klammer hinter „SupaLike nicht" listet weiterhin nur die vier **geprüften** Methoden —
das ist korrekt so und beschreibt exakt, was der Wächter tut.

- [ ] **Step 2: Veraltete Task-Referenzen in den Kommentaren bereinigen**

Im selben File verweisen zwei Kommentare auf eine „Task 5" eines längst abgeschlossenen
Plans. Solche Referenzen sind für Leser ohne den damaligen Plankontext wertlos.

Zeile 28-31, den Doc-Kommentar über `isSupaLike`:

```ts
/**
 * Laufzeit-Typwächter: erfüllt `editor` strukturell `SupaLike`? Nötig, weil
 * `createToolbar` ein `editor: unknown` entgegennimmt (Custom-Buttons erlauben
 * beliebige Werte) und die Toolbar auch mit Fremdobjekten umgehen muss.
 *
 * Geprüft werden bewusst nur diese vier Methoden — nicht die später ergänzten
 * `togglePreviewFullScreen`/`isPreviewFullScreenActive`. Sonst fielen Host-Objekte
 * durch die Prüfung, die nur die vier alten Methoden implementieren, und verlören
 * den Aktiv-Zustand aller view-Buttons.
 */
```

Und die Kommentarzeile bei Zeile 131:

```ts
    // `editor` implementiert SupaLike nur, wenn eine echte SupaMDE-Instanz
```

Prüfe die Zeile im Original und passe nur den Halbsatz an, der auf „Task 5" verweist —
den Rest des Kommentars unverändert lassen.

- [ ] **Step 3: Tests laufen lassen**

Run: `npx vitest run src/ui/__tests__/toolbar.test.ts`
Expected: PASS. Der bestehende Wächter-Test in `toolbar.test.ts` (Zeile ~96, Objekt `{}`)
prüft, **dass** gewarnt wird, nicht den Wortlaut — er bleibt unverändert grün.

Schlägt er wider Erwarten fehl, weil er den Meldungstext prüft: Passe die Erwartung an den
neuen Wortlaut an, aber schwäche die Zusicherung nicht ab.

- [ ] **Step 4: Typecheck und Lint**

Run: `npm run typecheck && npm run lint`
Expected: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add src/ui/toolbar.ts
git commit -m "docs(toolbar): Warntext des SupaLike-Wächters nennt alle view-Buttons"
```

---

### Task 3: `editor-mode` in der README-Button-Liste ergänzen

**Der Befund:** Die Aufzählung der Built-in-Toolbar-Buttons in `README.md:226-230` listet
`editor-mode` nicht auf, obwohl die Aktion in `BUILTIN_ACTIONS` registriert und in
`README.md:449` eigenständig dokumentiert ist. Reine Inkonsistenz zwischen zwei
README-Stellen.

Zur Einordnung: Bei README:449 steht ausdrücklich, dass `editor-mode` **nicht** Teil der
Default-Toolbar ist. Das bleibt richtig und wird nicht angetastet — die Aufzählung bei
Zeile 226 listet aber alle *verfügbaren* Built-in-Namen, nicht die Default-Belegung.
`side-by-side` und `fullscreen` stehen dort aus demselben Grund, obwohl sie ebenfalls
nicht mehr im Default sind.

**Files:**
- Modify: `README.md:226-230`

**Interfaces:**
- Consumes: nichts
- Produces: nichts (Doku)

- [ ] **Step 1: Vollständigkeit gegen den Code prüfen**

Run: `grep -oE "^  '?[a-z0-9-]+'?:" src/ui/actions.ts | tr -d " ':"`
Expected: die vollständige Liste der registrierten Built-in-Namen.

Gleiche sie mit der README-Aufzählung ab. Erwartet ist genau eine Abweichung:
`editor-mode` fehlt. Findest du weitere fehlende Namen, ergänze sie in derselben Task und
vermerke das im Report.

- [ ] **Step 2: Aufzählung ergänzen**

In `README.md` den Absatz bei Zeile 226 ersetzen:

```markdown
**Built-in-Toolbar-Buttons:** `bold`, `italic`, `strikethrough`, `code`,
`heading-smaller`, `heading-bigger`, `heading-1`…`heading-6`, `quote`, `code-block`,
`horizontal-rule`, `clean-block`, `unordered-list`, `ordered-list`, `check-list`,
`link`, `image`, `table`, `undo`, `redo`, `preview-fullscreen`, `side-by-side`,
`fullscreen`, `editor-mode`. `'|'` fügt einen Separator ein.
```

`editor-mode` steht bewusst am Ende bei den übrigen Ansichts-Aktionen, nicht alphabetisch —
die Liste folgt der Toolbar-Logik, wie die bestehende Reihenfolge zeigt.

- [ ] **Step 3: Diff sichten**

Run: `git diff README.md`
Expected: genau eine geänderte Zeile (die letzte Zeile des Absatzes). Ist der Diff größer,
wurde versehentlich umformatiert — zurücknehmen und nur die eine Zeile ändern.

Kein `prettier --write README.md` über die ganze Datei laufen lassen (siehe Global
Constraints).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: editor-mode in der Built-in-Button-Liste ergänzen"
```

---

### Task 4: Deklarationsreihenfolge in `preview.ts` an das Interface angleichen

**Der Befund:** Im `SideBySide`-Interface steht die Reihenfolge `toggle, set, isActive,
update, destroy`; in der Implementierung wird `set` vor `toggle` definiert. Rein
kosmetisch, kein Verhaltensunterschied.

**Bewertung vorab — diese Task ist optional.** `set` **muss** vor `toggle` stehen, weil
`toggle` es aufruft: Eine `const`-Deklaration ist vor ihrer Initialisierung nicht
verwendbar. Die Implementierungsreihenfolge ist also sachlich zwingend, nicht willkürlich.
Angleichbar ist damit nur das **Interface**, nicht die Implementierung.

Die ehrlichste Auflösung ist deshalb, das Interface an die Implementierung anzupassen —
nicht umgekehrt. Wer den Befund lieber unangetastet lässt, überspringt diese Task
folgenlos; sie ist von den Tasks 1–3 vollständig unabhängig.

**Files:**
- Modify: `src/ui/preview.ts` (Interface `SideBySide`)

**Interfaces:**
- Consumes: nichts
- Produces: keine Änderung an Typen oder Verhalten — nur die Reihenfolge der
  Member-Deklarationen im Interface. TypeScript-Interfaces sind reihenfolgeunabhängig.

- [ ] **Step 1: Interface-Reihenfolge angleichen**

In `src/ui/preview.ts` das Interface so umsortieren, dass es der Implementierung folgt:

```ts
export interface SideBySide {
  dom: HTMLElement;
  /** Schaltet gezielt auf `next`. Idempotent — gleicher Wert ändert nichts. */
  set(next: boolean): void;
  toggle(): void;
  isActive(): boolean;
  update(state: EditorState): void;
  destroy(): void;
}
```

Nur die Reihenfolge ändern. Signaturen und Doc-Kommentare bleiben wortgleich.

- [ ] **Step 2: Tests, Typecheck und Lint**

Run: `npm run test:run && npm run typecheck && npm run lint`
Expected: alles grün. Eine Reihenfolgeänderung im Interface kann nichts brechen — schlägt
etwas fehl, wurde versehentlich mehr geändert als die Reihenfolge.

- [ ] **Step 3: Commit**

```bash
git add src/ui/preview.ts
git commit -m "refactor(ui): SideBySide-Interface folgt der Implementierungsreihenfolge"
```

---

## Abschluss-Verifikation

Nach der letzten umgesetzten Task:

Run: `npm run test:run && npm run typecheck && npm run lint`
Expected: alles grün.

## Manuelle Abnahme (nur Task 1)

Der Overflow-Bug lässt sich in jsdom zwar testen, aber nicht wirklich *sehen*. Wer ihn im
Browser gegenprüfen will, braucht eine Seite mit **zwei** Editoren — die Beispielseite hat
derzeit nur einen. Vorgehen:

1. In `example/index.html` einen zweiten `<textarea>` samt zweiter `new SupaMDE({…})`-Instanz
   ergänzen und die Seite so lang machen, dass sie scrollt.
2. `npm run dev`, dann Editor A ins Vollbild (F11), Editor B ins Vollbild (F11).
3. Editor A mit Escape verlassen → die Seite darf **nicht** hinter dem Vollbild von B
   scrollen.
4. Editor B mit Escape verlassen → die Seite muss wieder normal scrollen. Vor dem Fix bleibt
   sie hier gesperrt.
5. Die Änderung an `example/index.html` anschließend verwerfen (`git checkout example/index.html`)
   oder als eigenständige Demo-Erweiterung committen — das ist eine bewusste Entscheidung,
   keine Nebenwirkung dieses Plans.
