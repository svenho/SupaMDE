# Kombinierter Vorschau-Vollbild-Button — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Toolbar-Button (`'preview-fullscreen'`, Kürzel F8) schaltet Side-by-Side-Vorschau und Vollbild gemeinsam ein bzw. aus.

**Architecture:** Die beiden Modi bleiben intern entkoppelt (zwei unabhängige Flags, kein neuer State). Die Vorschau- und Fullscreen-Module bekommen je einen idempotenten `set(next)`; die SupaMDE-Instanz bekommt daraus abgeleitete Setter und einen Kombi-Toggle nach dem Alles-oder-nichts-Prinzip. Der Button ist eine gewöhnliche `kind: 'view'`-Action in der bestehenden Registry.

**Tech Stack:** TypeScript 5.9, CodeMirror 6, Vitest (jsdom), Lucide-Icons, ESLint/Prettier.

## Global Constraints

- Sprache im Code: Kommentare und Doc-Kommentare auf Deutsch, wie im gesamten Repo. Umlaute korrekt (`ü`, `ö`, `ä`, `ß`), keine ASCII-Ersatzschreibweisen.
- Testframework: Vitest. Einzelne Datei laufen lassen mit `npx vitest run <pfad>`, alles mit `npm run test:run`.
- Typecheck: `npm run typecheck`. Lint: `npm run lint`.
- Es gibt **kein** CHANGELOG.md im Repo — entgegen der Spec entfällt dieser Punkt. Dokumentiert wird ausschließlich in `README.md`.
- Verhaltensregel (Alles-oder-nichts): `active` ist genau `isSideBySideActive() && isFullscreenActive()`. Ein Klick bei nicht-beiden-aktiv schaltet **beide an**; ein Klick bei beiden-aktiv schaltet **beide aus**.
- Die bestehenden Einzel-Actions `'side-by-side'` und `'fullscreen'` sowie deren Kürzel (F9, F11, `Mod-Shift-F`) bleiben unverändert und in `BUILTIN_ACTIONS` registriert.
- Neuer Built-in-Name: `'preview-fullscreen'`. Titel: `'Vorschau im Vollbild'`. Kürzel: `'F8'`. Icon-Schlüssel: `'preview-fullscreen'` → Lucide `Maximize2`.

---

### Task 1: Idempotentes `set()` für Fullscreen und Side-by-Side

Die Module können heute nur invertieren (`toggle()`). Für „schalte beide auf X" braucht die Instanz Setter, die bei bereits passendem Zustand nichts tun. `createFullscreen` hat die Logik intern schon (`set(next)` mit `if (next === active) return`) — sie wird nur nach außen gereicht. `createSideBySide` bekommt sie neu.

**Files:**
- Modify: `src/ui/fullscreen.ts` (Interface `Fullscreen`, Return-Objekt)
- Modify: `src/ui/preview.ts` (Interface `SideBySide`, Return-Objekt)
- Test: `src/ui/__tests__/fullscreen.test.ts`, `src/ui/__tests__/preview.test.ts`

**Interfaces:**
- Consumes: nichts (erste Task)
- Produces: `Fullscreen.set(next: boolean): void` und `SideBySide.set(next: boolean): void`. Beide idempotent: ein Aufruf mit dem bereits aktiven Wert ändert nichts und löst keinen Callback und kein Re-Render aus.

- [ ] **Step 1: Failing Test für `Fullscreen.set()` schreiben**

Ans Ende des `describe('createFullscreen', …)`-Blocks in `src/ui/__tests__/fullscreen.test.ts` einfügen:

```ts
  it('set() schaltet gezielt und ist idempotent', () => {
    const el = container();
    const cb = vi.fn();
    const fs = createFullscreen(el, { onToggleFullScreen: cb });

    fs.set(true);
    expect(fs.isActive()).toBe(true);
    expect(el.classList.contains('supamde-fullscreen')).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);

    // Zweiter Aufruf mit demselben Wert: kein Zustandswechsel, kein Callback.
    fs.set(true);
    expect(fs.isActive()).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);

    fs.set(false);
    expect(fs.isActive()).toBe(false);
    expect(cb).toHaveBeenCalledTimes(2);
    fs.set(false);
    expect(cb).toHaveBeenCalledTimes(2);

    fs.destroy();
  });
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/ui/__tests__/fullscreen.test.ts`
Expected: FAIL — `fs.set is not a function`

- [ ] **Step 3: `set` auf dem Fullscreen-Interface exportieren**

In `src/ui/fullscreen.ts` das Interface erweitern (die interne `set`-Funktion existiert bereits):

```ts
export interface Fullscreen {
  toggle(): void;
  /** Schaltet gezielt auf `next`. Idempotent — gleicher Wert ändert nichts. */
  set(next: boolean): void;
  isActive(): boolean;
  destroy(): void;
}
```

Und im Return-Objekt am Ende von `createFullscreen` ergänzen:

```ts
  return {
    toggle: () => set(!active),
    set,
    isActive: () => active,
    destroy: () => {
      container.removeEventListener('keydown', onKeydown);
      if (active) set(false);
    },
  };
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/ui/__tests__/fullscreen.test.ts`
Expected: PASS (alle Tests der Datei)

- [ ] **Step 5: Failing Test für `SideBySide.set()` schreiben**

In `src/ui/__tests__/preview.test.ts` ans Ende des äußersten `describe`-Blocks einfügen. Der Helfer zum Erzeugen einer `EditorView` heißt in dieser Datei `viewWith(doc: string)`:

```ts
  it('set() schaltet gezielt und ist idempotent', () => {
    const view = viewWith('# Titel');
    const render = vi.fn((text: string) => `<p>${text}</p>`);
    const sbs = createSideBySide(view, { render });

    sbs.set(true);
    expect(sbs.isActive()).toBe(true);
    expect(sbs.dom.style.display).toBe('');
    expect(render).toHaveBeenCalledTimes(1);

    // Zweiter Aufruf mit demselben Wert: kein erneutes Rendern.
    sbs.set(true);
    expect(sbs.isActive()).toBe(true);
    expect(render).toHaveBeenCalledTimes(1);

    sbs.set(false);
    expect(sbs.isActive()).toBe(false);
    expect(sbs.dom.style.display).toBe('none');
    sbs.set(false);
    expect(sbs.isActive()).toBe(false);

    sbs.destroy();
    view.destroy();
  });
```

Hinweis: `vi` ggf. dem bestehenden Import aus `vitest` hinzufügen.

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/ui/__tests__/preview.test.ts`
Expected: FAIL — `sbs.set is not a function`

- [ ] **Step 7: `set` in `preview.ts` implementieren**

Interface erweitern:

```ts
export interface SideBySide {
  dom: HTMLElement;
  toggle(): void;
  /** Schaltet gezielt auf `next`. Idempotent — gleicher Wert ändert nichts. */
  set(next: boolean): void;
  isActive(): boolean;
  update(state: EditorState): void;
  destroy(): void;
}
```

`toggle` auf `set` umstellen, damit es genau einen Schaltpfad gibt (ersetzt die bisherige `toggle`-Definition):

```ts
  const set = (next: boolean): void => {
    if (next === active) return;
    active = next;
    dom.style.display = active ? '' : 'none';
    if (active) rerender(view.state);
  };

  const toggle = (): void => set(!active);
```

Und im Return-Objekt `set` ergänzen:

```ts
  return { dom, toggle, set, isActive: () => active, update, destroy };
```

- [ ] **Step 8: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/ui/__tests__/preview.test.ts src/ui/__tests__/fullscreen.test.ts`
Expected: PASS

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: keine Fehler

- [ ] **Step 10: Commit**

```bash
git add src/ui/fullscreen.ts src/ui/preview.ts src/ui/__tests__/fullscreen.test.ts src/ui/__tests__/preview.test.ts
git commit -m "feat(ui): idempotentes set() für Fullscreen und Side-by-Side"
```

---

### Task 2: Kombi-Toggle auf der SupaMDE-Instanz

**Files:**
- Modify: `src/index.ts` (neue Methoden; `toggleSideBySide` / `toggleFullScreen` auf die Setter umstellen)
- Test: `src/__tests__/index.test.ts`

**Interfaces:**
- Consumes: `Fullscreen.set(next: boolean)` und `SideBySide.set(next: boolean)` aus Task 1
- Produces: auf `SupaMDE` — `setSideBySide(on: boolean): void`, `setFullScreen(on: boolean): void`, `togglePreviewFullScreen(): void`, `isPreviewFullScreenActive(): boolean`

- [ ] **Step 1: Failing Test für alle vier Ausgangszustände schreiben**

In `src/__tests__/index.test.ts` einen neuen `describe`-Block ans Dateiende anfügen. Der Helfer `attachedTextarea` existiert bereits in der Datei innerhalb des Blocks `describe('SupaMDE (Editor-API, M1)', …)` — für den neuen Block eine eigene lokale Kopie anlegen:

```ts
describe('SupaMDE: kombinierter Vorschau-Vollbild-Modus', () => {
  function attachedTextarea(value = ''): HTMLTextAreaElement {
    const ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    return ta;
  }

  it('schaltet aus "beides aus" beide Modi ein und wieder aus', () => {
    const ta = attachedTextarea('# Titel');
    const editor = new SupaMDE({ element: ta });

    expect(editor.isPreviewFullScreenActive()).toBe(false);

    editor.togglePreviewFullScreen();
    expect(editor.isSideBySideActive()).toBe(true);
    expect(editor.isFullscreenActive()).toBe(true);
    expect(editor.isPreviewFullScreenActive()).toBe(true);

    editor.togglePreviewFullScreen();
    expect(editor.isSideBySideActive()).toBe(false);
    expect(editor.isFullscreenActive()).toBe(false);
    expect(editor.isPreviewFullScreenActive()).toBe(false);

    editor.toTextArea();
  });

  it('führt aus dem Teilzustand "nur Vorschau" in den Vollzustand', () => {
    const ta = attachedTextarea();
    const editor = new SupaMDE({ element: ta });

    editor.toggleSideBySide();
    expect(editor.isSideBySideActive()).toBe(true);
    expect(editor.isFullscreenActive()).toBe(false);
    expect(editor.isPreviewFullScreenActive()).toBe(false);

    editor.togglePreviewFullScreen();
    expect(editor.isSideBySideActive()).toBe(true);
    expect(editor.isFullscreenActive()).toBe(true);

    editor.toTextArea();
  });

  it('führt aus dem Teilzustand "nur Vollbild" in den Vollzustand', () => {
    const ta = attachedTextarea();
    const editor = new SupaMDE({ element: ta });

    editor.toggleFullScreen();
    expect(editor.isFullscreenActive()).toBe(true);
    expect(editor.isSideBySideActive()).toBe(false);
    expect(editor.isPreviewFullScreenActive()).toBe(false);

    editor.togglePreviewFullScreen();
    expect(editor.isSideBySideActive()).toBe(true);
    expect(editor.isFullscreenActive()).toBe(true);

    editor.toTextArea();
  });

  it('setSideBySide/setFullScreen sind idempotent', () => {
    const ta = attachedTextarea();
    const editor = new SupaMDE({ element: ta });

    editor.setSideBySide(true);
    editor.setSideBySide(true);
    expect(editor.isSideBySideActive()).toBe(true);

    editor.setFullScreen(false);
    expect(editor.isFullscreenActive()).toBe(false);

    editor.toTextArea();
  });

  it('setzt die Container-Klasse supamde-sided auch über den Kombi-Toggle', () => {
    const ta = attachedTextarea();
    const editor = new SupaMDE({ element: ta });

    editor.togglePreviewFullScreen();
    const container = document.querySelector('.supamde-container');
    expect(container?.classList.contains('supamde-sided')).toBe(true);
    expect(container?.classList.contains('supamde-fullscreen')).toBe(true);

    editor.toTextArea();
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/__tests__/index.test.ts`
Expected: FAIL — `editor.isPreviewFullScreenActive is not a function`

- [ ] **Step 3: Setter und Kombi-Toggle implementieren**

In `src/index.ts` den Block um `toggleSideBySide` / `toggleFullScreen` ersetzen. Die `toggle*`-Methoden delegieren an die Setter, damit die Container-Klasse und das Toolbar-Update genau an einer Stelle gepflegt werden:

```ts
  /**
   * Schaltet die Nebeneinander-Vorschau gezielt an oder aus. Idempotent —
   * ein Aufruf mit dem bereits aktiven Zustand ändert nichts.
   */
  setSideBySide(on: boolean): void {
    this.preview?.set(on);
    this.container.classList.toggle('supamde-sided', this.isSideBySideActive());
    this.toolbar?.update(this.codemirror.state);
  }
  toggleSideBySide(): void {
    this.setSideBySide(!this.isSideBySideActive());
  }
  isSideBySideActive(): boolean {
    return this.preview?.isActive() ?? false;
  }

  /** Schaltet den Vollbildmodus gezielt an oder aus. Idempotent. */
  setFullScreen(on: boolean): void {
    this.fullscreen.set(on);
    this.toolbar?.update(this.codemirror.state);
  }
  toggleFullScreen(): void {
    this.setFullScreen(!this.isFullscreenActive());
  }
  isFullscreenActive(): boolean {
    return this.fullscreen.isActive();
  }

  /**
   * Vorschau UND Vollbild gemeinsam schalten (Alles-oder-nichts): Ist nicht
   * bereits beides aktiv, wird beides eingeschaltet — auch aus einem
   * Teilzustand heraus. Sind beide aktiv, wird beides ausgeschaltet.
   */
  togglePreviewFullScreen(): void {
    const on = !this.isPreviewFullScreenActive();
    this.setSideBySide(on);
    this.setFullScreen(on);
  }
  /** Ob Vorschau und Vollbild gleichzeitig aktiv sind. */
  isPreviewFullScreenActive(): boolean {
    return this.isSideBySideActive() && this.isFullscreenActive();
  }
```

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/__tests__/index.test.ts`
Expected: PASS (auch die bestehenden Side-by-Side- und Fullscreen-Tests der Datei)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: Fehler in `src/index.ts` an der Zeile `const _supaLikeCheck: SupaLike = …` sind hier **nicht** zu erwarten (SupaMDE hat mehr Methoden als `SupaLike` verlangt, das ist zulässig). Erwartet: keine Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/__tests__/index.test.ts
git commit -m "feat(index): togglePreviewFullScreen schaltet Vorschau und Vollbild gemeinsam"
```

---

### Task 3: Icon, `SupaLike`-Vertrag und Built-in-Action

**Files:**
- Modify: `src/ui/icons.ts` (Lucide-Import `Maximize2`, Eintrag `'preview-fullscreen'`)
- Modify: `src/ui/actions.ts` (Interface `SupaLike`, Registry-Eintrag)
- Test: `src/ui/__tests__/icons.test.ts`, `src/ui/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `togglePreviewFullScreen()` / `isPreviewFullScreenActive()` aus Task 2
- Produces: `BUILTIN_ACTIONS['preview-fullscreen']` — eine `kind: 'view'`-Action mit `run(editor: SupaLike)`, `active(editor: SupaLike)`, `icon: 'preview-fullscreen'`, `title: 'Vorschau im Vollbild'`, `shortcut: 'F8'`. Das Interface `SupaLike` enthält ab hier `togglePreviewFullScreen(): void` und `isPreviewFullScreenActive(): boolean` — alle Test-Doubles von `SupaLike` müssen beide Methoden mitführen.

- [ ] **Step 1: Failing Test für Icon und Action schreiben**

In `src/ui/__tests__/icons.test.ts` ergänzen (an das dort vorhandene `describe` anfügen):

```ts
  it('kennt das Icon preview-fullscreen', () => {
    expect(hasIcon('preview-fullscreen')).toBe(true);
    expect(renderIcon('preview-fullscreen')).toBeInstanceOf(SVGElement);
  });
```

Falls `renderIcon` in der Datei noch nicht importiert ist, dem bestehenden Import aus `../icons` hinzufügen.

In `src/ui/__tests__/actions.test.ts` ans Dateiende anfügen:

```ts
describe('view-Aktion preview-fullscreen', () => {
  /** Test-Double der SupaMDE-Instanz mit steuerbarem Ausgangszustand. */
  function fakeEditor(sideBySide: boolean, fullscreen: boolean) {
    const state = { sideBySide, fullscreen };
    return {
      state,
      toggleSideBySide: vi.fn(),
      toggleFullScreen: vi.fn(),
      isSideBySideActive: () => state.sideBySide,
      isFullscreenActive: () => state.fullscreen,
      toggleEditorMode: vi.fn(),
      getEditorMode: () => 'source' as const,
      togglePreviewFullScreen: vi.fn(() => {
        const on = !(state.sideBySide && state.fullscreen);
        state.sideBySide = on;
        state.fullscreen = on;
      }),
      isPreviewFullScreenActive: () => state.sideBySide && state.fullscreen,
    };
  }

  it('ist registriert, hat Titel, Icon und das Kürzel F8', () => {
    const action = getAction('preview-fullscreen');
    expect(action?.kind).toBe('view');
    expect(action?.title).toBe('Vorschau im Vollbild');
    expect(action?.icon).toBe('preview-fullscreen');
    expect(action?.shortcut).toBe('F8');
  });

  it('run() ruft togglePreviewFullScreen', () => {
    const action = getAction('preview-fullscreen');
    const editor = fakeEditor(false, false);
    if (action?.kind === 'view') action.run(editor);
    expect(editor.togglePreviewFullScreen).toHaveBeenCalled();
  });

  it('active() nur wenn beide Modi aktiv sind', () => {
    const action = getAction('preview-fullscreen');
    if (action?.kind !== 'view') throw new Error('view-Aktion erwartet');

    expect(action.active?.(fakeEditor(false, false))).toBe(false);
    expect(action.active?.(fakeEditor(true, false))).toBe(false);
    expect(action.active?.(fakeEditor(false, true))).toBe(false);
    expect(action.active?.(fakeEditor(true, true))).toBe(true);
  });

  it('run() führt aus jedem Teilzustand in den Vollzustand', () => {
    const action = getAction('preview-fullscreen');
    if (action?.kind !== 'view') throw new Error('view-Aktion erwartet');

    for (const [sbs, fs] of [
      [false, false],
      [true, false],
      [false, true],
    ] as const) {
      const editor = fakeEditor(sbs, fs);
      action.run(editor);
      expect(editor.isPreviewFullScreenActive()).toBe(true);
    }

    // Aus dem Vollzustand heraus: beides aus.
    const both = fakeEditor(true, true);
    action.run(both);
    expect(both.isSideBySideActive()).toBe(false);
    expect(both.isFullscreenActive()).toBe(false);
  });
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/ui/__tests__/icons.test.ts src/ui/__tests__/actions.test.ts`
Expected: FAIL — `hasIcon('preview-fullscreen')` ist `false`; `getAction('preview-fullscreen')` ist `undefined`

- [ ] **Step 3: Icon registrieren**

In `src/ui/icons.ts` `Maximize2` dem Lucide-Import hinzufügen (alphabetisch passend zwischen `Fullscreen` und `Eye` einsortieren ist nicht nötig — die bestehende Reihenfolge folgt der Toolbar-Logik, also hinter `Fullscreen` einfügen):

```ts
  Columns2,
  Fullscreen,
  Maximize2,
  Eye,
```

Und im `ICONS`-Mapping hinter `fullscreen` ergänzen:

```ts
  fullscreen: Fullscreen,
  'preview-fullscreen': Maximize2,
```

- [ ] **Step 4: `SupaLike` erweitern**

In `src/ui/actions.ts` das Interface ergänzen:

```ts
export interface SupaLike {
  toggleSideBySide(): void;
  toggleFullScreen(): void;
  isSideBySideActive(): boolean;
  isFullscreenActive(): boolean;
  togglePreviewFullScreen(): void;
  isPreviewFullScreenActive(): boolean;
  toggleEditorMode(): void;
  getEditorMode(): EditorMode;
}
```

Wichtig: Die bestehenden Test-Doubles in `src/ui/__tests__/actions.test.ts` und `src/ui/__tests__/toolbar.test.ts` sind damit unvollständig, sofern sie als `SupaLike` typisiert sind. Falls der Typecheck in Step 7 dort Fehler meldet, die beiden neuen Methoden in den betroffenen Doubles ergänzen:

```ts
      togglePreviewFullScreen: vi.fn(),
      isPreviewFullScreenActive: () => false,
```

**Den Laufzeit-Wächter `isSupaLike()` in `src/ui/toolbar.ts:32-40` NICHT erweitern.** Er prüft bewusst nur die vier bisherigen Ansichts-Methoden. Nimmt man die zwei neuen mit auf, fallen Host-Objekte, die nur die alten vier implementieren, durch die Prüfung — die Toolbar würde dann für sie den Aktiv-Zustand aller view-Buttons verlieren und eine Warnung ausgeben. Das ist eine stille Regression, die kein bestehender Test abfängt.

Damit bleibt bewusst eine Lücke offen: Ein Host-Objekt, das nur die vier alten Methoden hat, passiert den Wächter und würde bei `'preview-fullscreen'` in `toolbar.ts:139` (`active(editor)`) bzw. `toolbar.ts:80` (`run(...)`, ganz ohne Wächter) einen `TypeError` auslösen. Dieser Fall tritt nur auf, wenn jemand ein Fremdobjekt statt einer `SupaMDE`-Instanz an `createToolbar` übergibt **und** den neuen Button explizit konfiguriert — er ist im Default-Pfad unerreichbar.

Diese Lücke wird in diesem Plan **nicht** geschlossen: eine saubere Lösung (getrennter Wächter pro Action oder optionale Methoden auf `SupaLike`) ist ein eigenständiger Umbau der Toolbar-Fehlerbehandlung und gehört nicht in dieses Feature. Wer sie später angeht, findet den Kontext hier. Die zwei bestehenden Aufruf-Stellen bleiben unverändert.

- [ ] **Step 5: Action registrieren**

In `src/ui/actions.ts` in `BUILTIN_ACTIONS` direkt hinter dem `fullscreen`-Eintrag einfügen:

```ts
  'preview-fullscreen': {
    kind: 'view',
    run: (editor) => editor.togglePreviewFullScreen(),
    active: (editor) => editor.isPreviewFullScreenActive(),
    icon: 'preview-fullscreen',
    title: 'Vorschau im Vollbild',
    shortcut: 'F8',
  },
```

- [ ] **Step 6: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/ui/__tests__/icons.test.ts src/ui/__tests__/actions.test.ts src/ui/__tests__/toolbar.test.ts`
Expected: PASS

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: keine Fehler. Meldet er fehlende Methoden in Test-Doubles, diese wie in Step 4 beschrieben ergänzen und erneut laufen lassen.

- [ ] **Step 8: Commit**

```bash
git add src/ui/icons.ts src/ui/actions.ts src/ui/__tests__/
git commit -m "feat(toolbar): Built-in-Aktion preview-fullscreen mit Icon und F8-Kürzel"
```

---

### Task 4: F8-Tastenkürzel verdrahten

**Files:**
- Modify: `src/index.ts` (Handler `onViewShortcuts`, Konstruktor-Kommentar)
- Test: `src/__tests__/index.test.ts`

**Interfaces:**
- Consumes: `togglePreviewFullScreen()` aus Task 2
- Produces: F8 auf dem Container löst den Kombi-Toggle aus und ruft `preventDefault()`

- [ ] **Step 1: Failing Test schreiben**

In `src/__tests__/index.test.ts` in den in Task 2 angelegten `describe`-Block einfügen:

```ts
  it('F8 schaltet Vorschau und Vollbild gemeinsam', () => {
    const ta = attachedTextarea();
    const editor = new SupaMDE({ element: ta });
    const container = document.querySelector('.supamde-container');
    if (!container) throw new Error('Container fehlt');

    const event = new KeyboardEvent('keydown', {
      key: 'F8',
      bubbles: true,
      cancelable: true,
    });
    container.dispatchEvent(event);

    expect(editor.isPreviewFullScreenActive()).toBe(true);
    expect(event.defaultPrevented).toBe(true);

    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'F8', bubbles: true, cancelable: true }),
    );
    expect(editor.isPreviewFullScreenActive()).toBe(false);

    editor.toTextArea();
  });
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/__tests__/index.test.ts -t 'F8'`
Expected: FAIL — `isPreviewFullScreenActive()` bleibt `false`

- [ ] **Step 3: F8-Zweig implementieren**

In `src/index.ts` in `onViewShortcuts` als ersten Zweig vor `if (event.key === 'F9')` einfügen:

```ts
      if (event.key === 'F8') {
        // Vorschau + Vollbild gemeinsam (Alles-oder-nichts, siehe togglePreviewFullScreen).
        event.preventDefault();
        this.togglePreviewFullScreen();
      } else if (event.key === 'F9') {
```

Den Konstruktor-Kommentar oberhalb von `this.onViewShortcuts` anpassen: aus „F9/F10/F11 sind view-Aktionen (side-by-side/editorMode/fullscreen)" wird „F8/F9/F10/F11 sind view-Aktionen (preview-fullscreen/side-by-side/editorMode/fullscreen)". Ebenso die Kommentarzeile am Feld `onViewShortcuts` von „F9/F10/F11-Keydown-Handler" auf „F8/F9/F10/F11-Keydown-Handler" ändern.

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/__tests__/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/__tests__/index.test.ts
git commit -m "feat(keys): F8 schaltet Vorschau und Vollbild gemeinsam"
```

---

### Task 5: Default-Toolbar auf den Kombi-Button umstellen

**Files:**
- Modify: `src/ui/toolbar-config.ts:41-42`
- Test: `src/ui/__tests__/toolbar-config.test.ts`

**Interfaces:**
- Consumes: `BUILTIN_ACTIONS['preview-fullscreen']` aus Task 3
- Produces: `DEFAULT_TOOLBAR` endet auf `'|', 'preview-fullscreen'`; `'side-by-side'` und `'fullscreen'` bleiben über `getAction` auflösbar, sind aber nicht mehr im Default

- [ ] **Step 1: Failing Test schreiben**

In `src/ui/__tests__/toolbar-config.test.ts` ans Dateiende anfügen:

```ts
describe('DEFAULT_TOOLBAR: kombinierter Vorschau-Vollbild-Button', () => {
  it('enthält preview-fullscreen statt der beiden Einzel-Buttons', () => {
    expect(DEFAULT_TOOLBAR).toContain('preview-fullscreen');
    expect(DEFAULT_TOOLBAR).not.toContain('side-by-side');
    expect(DEFAULT_TOOLBAR).not.toContain('fullscreen');
  });

  it('die Einzel-Buttons bleiben explizit konfigurierbar', () => {
    const resolved = resolveToolbar(['side-by-side', 'fullscreen']);
    expect(resolved).toHaveLength(2);
    expect(resolved?.[0]).toMatchObject({ kind: 'builtin', name: 'side-by-side' });
    expect(resolved?.[1]).toMatchObject({ kind: 'builtin', name: 'fullscreen' });
  });

  it('der Default löst vollständig auf (keine unbekannten Namen)', () => {
    const resolved = resolveToolbar(undefined);
    expect(resolved).not.toBeNull();
    expect(resolved).toHaveLength(DEFAULT_TOOLBAR.length);
  });
});
```

Sicherstellen, dass `DEFAULT_TOOLBAR` und `resolveToolbar` in der Datei importiert sind; sonst dem bestehenden Import aus `../toolbar-config` hinzufügen.

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/ui/__tests__/toolbar-config.test.ts`
Expected: FAIL — `DEFAULT_TOOLBAR` enthält noch `'side-by-side'` und `'fullscreen'`

- [ ] **Step 3: Default-Toolbar anpassen**

In `src/ui/toolbar-config.ts` die letzten beiden Einträge ersetzen:

```ts
  '|',
  'preview-fullscreen',
];
```

Und den Doc-Kommentar über `DEFAULT_TOOLBAR` ergänzen:

```ts
/**
 * Default-Toolbar. `'|'` ist ein Separator.
 *
 * Ansicht: der Default zeigt den kombinierten `'preview-fullscreen'`-Button
 * (Vorschau + Vollbild in einem Schritt). Die Einzel-Buttons `'side-by-side'`
 * und `'fullscreen'` bleiben registriert und lassen sich über die
 * `toolbar`-Option weiterhin einzeln einsetzen.
 */
```

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/ui/__tests__/toolbar-config.test.ts`
Expected: PASS

- [ ] **Step 5: Gesamte Suite, Typecheck und Lint**

Run: `npm run test:run && npm run typecheck && npm run lint`
Expected: alles grün. Schlägt ein bestehender Test fehl, weil er die alte Default-Toolbar erwartet (z. B. in `toolbar.test.ts`), diesen auf den neuen Default anpassen — das geänderte Verhalten ist beabsichtigt.

- [ ] **Step 6: Commit**

```bash
git add src/ui/toolbar-config.ts src/ui/__tests__/
git commit -m "feat(toolbar)!: Default-Toolbar zeigt preview-fullscreen statt zweier Einzel-Buttons"
```

---

### Task 6: README aktualisieren

Die README ist die einzige Doku-Quelle im Repo (kein CHANGELOG vorhanden). Drei Stellen sind betroffen: die Liste der Built-in-Buttons, die Kürzel-Tabelle und ein kurzer Absatz zum Verhalten.

**Files:**
- Modify: `README.md` (Abschnitt „Toolbar & Statusbar (M3)" ab Zeile 226; Kürzel-Tabelle im Abschnitt „Tastenkürzel (M2)" ab Zeile 479)

**Interfaces:**
- Consumes: alles aus den Tasks 1–5 (Name, Titel, Kürzel, Default-Toolbar-Verhalten)
- Produces: nichts (Doku-Abschluss)

- [ ] **Step 1: Built-in-Button-Liste ergänzen**

Im Abschnitt „Toolbar & Statusbar (M3)" den Absatz „**Built-in-Toolbar-Buttons:**" so ersetzen, dass die Ansichts-Buttons mit aufgeführt sind (bisher fehlen sie in der Aufzählung ganz):

```markdown
**Built-in-Toolbar-Buttons:** `bold`, `italic`, `strikethrough`, `code`,
`heading-smaller`, `heading-bigger`, `heading-1`…`heading-6`, `quote`, `code-block`,
`horizontal-rule`, `clean-block`, `unordered-list`, `ordered-list`, `check-list`,
`link`, `image`, `table`, `undo`, `redo`, `preview-fullscreen`, `side-by-side`,
`fullscreen`. `'|'` fügt einen Separator ein.

**Ansichts-Buttons:** `preview-fullscreen` schaltet Nebeneinander-Vorschau und
Vollbild **gemeinsam** — ein Klick genügt für den Arbeitsmodus „Vorschau im
Vollbild". Der Button gilt als aktiv, wenn beide Modi laufen; aus einem
Teilzustand heraus (nur Vorschau oder nur Vollbild) schaltet ein Klick beides
ein. Er ist Teil der Default-Toolbar. Die Einzel-Buttons `side-by-side` und
`fullscreen` bleiben verfügbar, sind aber **nicht** mehr im Default — wer sie
weiterhin einzeln möchte, nimmt sie explizit in die `toolbar`-Option auf:

```js
new SupaMDE({
  element: document.querySelector('#editor'),
  toolbar: ['bold', 'italic', '|', 'side-by-side', 'fullscreen'],
});
```
```

- [ ] **Step 2: Kürzel-Tabelle ergänzen**

Im Abschnitt „Tastenkürzel (M2)" oberhalb der `F9`-Zeile einfügen:

```markdown
| `F8`                                  | Vorschau **und** Vollbild gemeinsam an/aus |
```

- [ ] **Step 3: README-Änderungen sichten**

Run: `git diff README.md`
Expected: nur die drei beschriebenen Stellen sind geändert; Tabellenspalten bleiben lesbar ausgerichtet.

- [ ] **Step 4: Formatierung prüfen**

Run: `npx prettier --check README.md`
Expected: PASS. Meldet Prettier Abweichungen, `npx prettier --write README.md` laufen lassen und den Diff erneut sichten.

- [ ] **Step 5: Abschluss-Verifikation der gesamten Änderung**

Run: `npm run test:run && npm run typecheck && npm run lint`
Expected: alles grün

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: kombinierten Vorschau-Vollbild-Button dokumentieren"
```

---

## Manuelle Abnahme

Nach Task 6 einmal im Browser gegenprüfen (`npm run dev`):

1. Die Toolbar zeigt rechts genau **einen** Ansichts-Button statt bisher zwei.
2. Klick darauf: Editor geht ins Vollbild **und** die Vorschau erscheint rechts — in einem Schritt.
3. Erneuter Klick: beides verschwindet, der Editor steht wieder normal in der Seite.
4. F8 macht dasselbe wie der Button.
5. Aus dem Teilzustand: F11 (bzw. `Cmd`+`Shift`+`F`) für Vollbild allein, dann F8 → die Vorschau kommt dazu, Vollbild bleibt.
6. Escape verlässt das Vollbild; die Vorschau bleibt dann sichtbar (unveränderte Bestandslogik) und der Kombi-Button ist nicht mehr als aktiv markiert.
