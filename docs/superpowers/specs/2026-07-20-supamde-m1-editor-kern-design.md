# M1 — Editor-Kern (Meilenstein-Spec)

**Datum:** 2026-07-20
**Status:** Freigegeben (Design)
**Übergreifende Spec:** `docs/superpowers/specs/2026-07-17-supamde-cm6-migration-design.md`
**Vorheriger Meilenstein:** M0 (Gerüst) — abgeschlossen

---

## 1. Ziel & Ergebnis

M1 verwandelt das M0-Skelett in einen **sichtbaren, live formatierenden Editor**.

Am Ende von M1 steht in `example/index.html` ein CodeMirror-6-Editor, der aus dem
Textarea-Inhalt initialisiert wird, den Markdown-Quelltext zeigt und ihn per
`HighlightStyle` live formatiert (Headings größer, `**fett**` fett, Code monospace
usw. — easyMDE-„Quasi-WYSIWYG"). Der Wert ist über `value()` / `getValue()` /
`setValue()` les- und setzbar; `toTextArea()` baut den Editor sauber zurück.

Diese Spec **verfeinert** nur die für M1 offenen Entscheidungen. Das Fundament
(Architektur, CM6-Idiome, Modulzuschnitt) stammt aus der übergreifenden Design-Spec
und wird hier nicht neu erfunden.

---

## 2. Abgrenzung — was NICHT in M1 ist

M1 liefert das **Kern-Set** des Options→Extensions-Mappings. Bewusst zurückgestellte
Optionen und Features bekommen **keinen** eigenen Sammel-Meilenstein (kein „M1a"),
sondern wandern zu dem Meilenstein, zu dem sie inhaltlich gehören:

| Zurückgestellt | Ziel-Meilenstein | Begründung |
|---|---|---|
| Shortcuts / Basis-Keymap | **M2** | Shortcuts *sind* Command-Bindings — ergeben erst mit den Commands Sinn. |
| `spellcheck` (nativ, `contentAttributes`) | **M2** | Einzeiler, in M2 mitnehmbar. |
| `lineNumbers` | **M2 / M3** | Reine Extension, unkritisch. |
| `direction` / RTL | **M3** | Hängt an Theme/UI-Layout. |
| Toolbar, Statusbar, Preview, SideBySide, Fullscreen | **M3 / M4** | Eigene Meilensteine. |
| px-/farbgenauer Theme-Feinschliff | **M3 / M6** | M1 liefert den Look, nicht die Pixel. |

**Kern-Set, das M1 abdeckt:** Doc-Init aus Textarea, `lineWrapping`, `placeholder`,
`autofocus`, `tabSize` / `indentUnit`, Basis-`theme`, Lezer-Markdown +
`HighlightStyle`.

---

## 3. Modulstruktur

M1 füllt genau die Editor-Kern-Module der übergreifenden Spec (Abschnitt 2), plus
`options.ts`. Keine neuen Module erfunden, keine zusammengelegt.

| Datei | Aufgabe | Abhängigkeiten |
|---|---|---|
| `options.ts` | `SupaMDEOptions`-Typ (Kern-Set), Defaults, Normalisierung roher User-Optionen → interne Form | keine (reine Logik) |
| `editor/setup.ts` | `fromTextArea`-Äquivalent: `EditorView` bauen, vor Textarea einfügen, Textarea verstecken, Form-Submit-Sync; `toTextArea()`-Rückbau | `@codemirror/view`, `@codemirror/state`, `extensions.ts` |
| `editor/extensions.ts` | stellt die CM6-Extension-Liste aus normalisierten Optionen zusammen (Kern-Set) | CM6-Pakete, `theme.ts`, `highlight.ts` |
| `editor/theme.ts` | `EditorView.theme` — Basis-Erscheinungsbild (Container, Font, Padding) | `@codemirror/view` |
| `editor/highlight.ts` | `HighlightStyle` für die Kern-Formatierungen | `@lezer/highlight`, `@codemirror/language` |
| `index.ts` (erweitert) | Fassade: Konstruktor ruft `setup.ts`; `value()`/`getValue()`/`setValue()`/`toTextArea()` delegieren | die obigen Module |

**Prinzip:** `options.ts`, `highlight.ts` und die value-Logik sind rein/headless
testbar. `index.ts` bleibt dünne Fassade — keine Editor-Logik in der Klasse selbst,
nur Delegation.

---

## 4. Datenfluss & Lebenszyklus

**Konstruktion** (`new SupaMDE({ element })`):

```
Optionen (roh) → options.ts normalisiert → extensions.ts baut Extension-Liste
                                                      │
                    setup.ts: EditorView({ doc: textarea.value, extensions })
                                                      │
                    view.dom vor Textarea einfügen, Textarea display:none
                                                      │
                    Form-Submit-Listener: textarea.value = view.state.doc (forceSync)
```

**Wert lesen / setzen:**

- `value()` / `getValue()` → `view.state.doc.toString()`
- `value(v)` / `setValue(v)` → `view.dispatch({ changes: { from: 0, to: docLength, insert: v } })`
- `value(v)` (mit Argument) und `setValue(v)` sind äquivalent; `value()` (ohne Argument)
  und `getValue()` sind äquivalent. `getValue`/`setValue` sind dünne Wrapper über
  dieselbe Logik (maximale Drop-in-Kompatibilität mit easyMDE).

**Rückbau** (`toTextArea()`):

```
textarea.value = view.state.doc  →  view.destroy()  →  Textarea-display wiederherstellen
→  Form-Submit-Listener entfernen  →  view.dom aus DOM entfernen
```

---

## 5. Knifflige Stellen (explizite Festlegungen)

1. **Doc-Init einmalig aus Textarea.** Der Textarea-Wert ist die Quelle *nur bei
   Konstruktion*. Danach ist `view.state.doc` die Wahrheit; die Textarea wird nur bei
   Form-Submit und `toTextArea()` zurückgeschrieben. **Kein** Zwei-Wege-Live-Sync.

2. **Form-Submit-Listener sauber referenzieren.** Die Listener-Funktion wird gespeichert,
   damit `toTextArea()` sie per `removeEventListener` wieder entfernt (sonst Leak bei
   wiederholtem Auf-/Abbau). easyMDE hatte hier historisch Schwächen.

3. **`element` fehlt / ist kein Textarea.** Definiertes Verhalten: Bei fehlendem oder
   ungültigem `element` wird ein aussagekräftiger Fehler geworfen (nicht still ein leerer
   Editor erzeugt). Wird unit-getestet.

---

## 6. HighlightStyle — easyMDE-Parität (Kern-Formatierungen)

Ziel: der charakteristische „lebende Formatierung im Quelltext"-Look, **nicht**
pixel-genaue Nachbildung. Abgedeckte Syntax-Knoten (Lezer-Markdown):

- **Headings** (Stufen 1–6): größer / fett, gestaffelt
- **strong / emphasis / strikethrough**
- **inline-code** und **code-block**: monospace, abgesetzter Hintergrund
- **quote**: abgesetzt (Rand/Farbe)
- **link**

Exakte Schriftgrößen, Farben und Abstände sind **nicht** Teil von M1 (→ M3 / M6).
Der `HighlightStyle` ordnet den Syntax-Knoten die Kern-Stile zu; das Feintuning der
Werte folgt später.

---

## 7. CM6-Abhängigkeiten & Packaging

M1 zieht die ersten echten Runtime-Dependencies ein:

- `@codemirror/state`, `@codemirror/view`
- `@codemirror/language`, `@codemirror/lang-markdown`
- `@lezer/highlight`

(`@codemirror/commands` — Undo/Redo/Keymap — kommt erst mit M2, nicht in M1.)

**Packaging-Entscheidung:** Die CM6-Pakete stehen in `dependencies` und werden in den
Library-Build **gebündelt** (nicht als `peerDependencies` / `external`). Konsumenten
machen nur `import SupaMDE` — wie easyMDE, das CM5 mitbrachte. Das passt zum
Drop-in-Ziel. Packaging-Feinheiten (Tree-Shaking, evtl. externalisieren) bleiben M6
vorbehalten.

---

## 8. Teststrategie & Verifikation

**Unit-Tests (Vitest + jsdom)** — Verhalten, headless:

| Testbereich | Prüft |
|---|---|
| `options.ts` | Normalisierung: Defaults greifen, User-Werte überschreiben, Kern-Flags korrekt abgelegt |
| `extensions.ts` | Bei gesetztem Flag ist die erwartete Extension in der Liste (z. B. `lineWrapping` an → `EditorView.lineWrapping` enthalten); Highlight/Theme immer dabei |
| value-Logik | Roundtrip: `setValue(x)` → `getValue() === x`; `value(x)`/`value()` äquivalent zu set/get; Init-Doc == Textarea-Inhalt |
| `setup.ts` | Nach Konstruktion: `view.dom` im DOM vor Textarea, Textarea `display:none`; `toTextArea()` stellt Textarea her, entfernt `view.dom` + Listener; Form-Submit schreibt Wert zurück |
| Fehlerfall | fehlendes / ungültiges `element` → aussagekräftiger Fehler |

**Manuell (nicht automatisiert):** Der HighlightStyle-Look wird in `example/index.html`
visuell geprüft — Headings größer, `**fett**` fett, Code monospace, Quote abgesetzt.

**Verifikations-Kommandos:** Der Meilenstein gilt erst als grün, wenn alle vier
Befehle ohne Fehler durchlaufen:

```
npm run build && npm run test:run && npm run lint && npm run typecheck
```

Die funktionalen Anforderungen, die diese Läufe absichern müssen, sind in Abschnitt 9
(Akzeptanzkriterien) einzeln festgehalten.

---

## 9. Akzeptanzkriterien

M1 ist **abgenommen**, wenn alle folgenden Kriterien erfüllt und (wo automatisierbar)
durch einen Test belegt sind. Jedes Kriterium ist einzeln prüfbar formuliert.

### 9.1 Editor-Erzeugung & Darstellung

- **AK-1 — Editor entsteht aus Textarea.** `new SupaMDE({ element: textarea })` erzeugt
  eine CM6-`EditorView`, deren `view.dom` im DOM **vor** der ursprünglichen Textarea
  steht; die Textarea ist auf `display:none` gesetzt.
- **AK-2 — Doc-Init aus Textarea.** Der initiale Editor-Inhalt entspricht exakt dem
  Textarea-Wert zum Konstruktionszeitpunkt (`getValue()` == Ausgangs-Textarea-Inhalt).
- **AK-3 — Live-Formatierung sichtbar.** In `example/index.html` wird der Markdown-
  Quelltext live formatiert dargestellt: Headings größer/fett, `**fett**` fett,
  `*kursiv*` kursiv, Inline- und Block-Code monospace mit abgesetztem Hintergrund,
  Quote abgesetzt, Links erkennbar. (Manuelle visuelle Abnahme.)

### 9.2 Wert-API (Drop-in)

- **AK-4 — Lesen.** `value()` und `getValue()` liefern beide den aktuellen Doc-Inhalt
  als String und sind äquivalent.
- **AK-5 — Setzen.** `value(x)` und `setValue(x)` ersetzen beide den kompletten
  Doc-Inhalt durch `x` und sind äquivalent.
- **AK-6 — Roundtrip.** Nach `setValue(x)` gilt `getValue() === x` für beliebige
  Strings (inkl. Mehrzeiler und Leerstring).

### 9.3 Rückbau & Form-Integration

- **AK-7 — `toTextArea()` baut sauber zurück.** Nach `toTextArea()` ist `view.dom`
  aus dem DOM entfernt, die Textarea wieder sichtbar, ihr Wert entspricht dem letzten
  Editor-Inhalt, und der Form-Submit-Listener ist per `removeEventListener` entfernt
  (kein Leak bei wiederholtem Auf-/Abbau).
- **AK-8 — Form-Submit-Sync.** Bei `submit` der umgebenden Form wird der aktuelle
  Editor-Inhalt in die Textarea zurückgeschrieben (`forceSync`), auch ohne
  `toTextArea()`.

### 9.4 Optionen (Kern-Set)

- **AK-9 — Optionen wirken als Extensions.** Für jede Kern-Option greift die erwartete
  CM6-Extension: `lineWrapping`, `placeholder`, `autofocus`, `tabSize`/`indentUnit`.
  Belegt durch `extensions.ts`-Tests (gesetztes Flag → erwartete Extension in der
  Liste). Highlight und Theme sind immer enthalten.
- **AK-10 — Defaults & Überschreibung.** `options.ts` normalisiert rohe User-Optionen:
  Defaults greifen bei fehlenden Werten, gesetzte User-Werte überschreiben Defaults.

### 9.5 Fehlerverhalten

- **AK-11 — Ungültiges `element`.** Bei fehlendem oder nicht-Textarea-`element` wirft
  der Konstruktor einen aussagekräftigen Fehler (kein still erzeugter leerer Editor).
  Durch Test belegt.

### 9.6 Build & Packaging

- **AK-12 — Toolchain grün.** Die vier Verifikations-Kommandos aus Abschnitt 8 laufen
  fehlerfrei durch.
- **AK-13 — Gebündelter Build.** Die CM6-Pakete stehen in `dependencies` und sind in
  den Library-Build gebündelt; ein Konsument benötigt nur `import SupaMDE`, ohne CM6
  separat zu installieren.

---

## 10. Offene Entscheidungen — geklärt

Alle für M1 relevanten Design-Entscheidungen sind in dieser Spec festgelegt:

- **Options-Umfang:** Kern-Set (Abschnitt 2), Rest zu M2/M3 zugeordnet.
- **HighlightStyle-Treue:** Kern-Formatierungen, keine Pixel-Parität (Abschnitt 6).
- **value-API:** `value()` + `getValue()`/`setValue()` — beide, für Drop-in (Abschnitt 4).
- **CM6-Packaging:** gebündelt in `dependencies` (Abschnitt 7).
- **Teststrategie:** Verhalten unit-getestet, Look manuell (Abschnitt 8).
