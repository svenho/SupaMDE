# Internationalisierung (i18n) der UI-Texte

**Datum:** 2026-10-03
**Status:** Design abgestimmt

## Problem

SupaMDE soll als npm-Paket für ein internationales Publikum erscheinen; die README
ist bereits englisch. Alle Texte, die Endnutzer sehen, sind aber fest auf Deutsch
im Code verdrahtet und — bis auf die Upload-Meldungen — nicht anpassbar:

| Bereich                         | Stelle                                            | Texte                                                 |
| ------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| Toolbar-Tooltips + `aria-label` | `ui/actions.ts` (`title`)                         | 29 Titel („Fett", „Überschrift größer" …)             |
| Statusbar                       | `ui/statusbar.ts` `builtinContent`                | „{n} Zeilen", „{n} Wörter" — ohne Plural („1 Zeilen") |
| Autosave-Status                 | `index.ts` `onSaved`                              | „Gespeichert: HH:MM", Uhrzeit in Browser-Locale       |
| Upload-Meldungen                | `features/image-upload.ts` `DEFAULT_UPLOAD_TEXTS` | 7 Texte, heute über `uploadImage.texts` anpassbar     |
| Eingefügter Dokumenttext        | `commands/table.ts`                               | Tabellenvorlage „Spalte 1 \| Spalte 2"                |

Entwicklermeldungen (6× `console.warn`, 2 `Error` in `editor/setup.ts`) sind
ebenfalls deutsch, richten sich aber an Entwickler, nicht an Endnutzer.

## Ziel und Erfolgskriterien

- Ohne Konfiguration spricht der Editor **Englisch**.
- Deutsch wird mitgeliefert und ist mit einer Zeile Konfiguration aktiv.
- Alle Endnutzer-Texte kommen aus einer zentralen, austauschbaren Quelle; eine
  weitere Sprache lässt sich ohne Codeänderung am Editor ergänzen.
- Einzelne Texte lassen sich überschreiben, ohne eine ganze Sprache zu schreiben.
- Zahlabhängige Texte haben korrekte Pluralformen.

## Entscheidungen

| Frage                      | Entscheidung                                                          | Verworfen                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Default-Sprache            | Englisch, Deutsch mitgeliefert                                        | Deutsch als Default; Auto-Erkennung über `navigator.language` (unvorhersehbar, Tests müssten Sprache pinnen)                            |
| Sprachwahl                 | Locale-**Objekt** importieren (`locale: de`)                          | String (`locale: 'de'`) — alle Sprachen immer im Bundle, eigene Sprachen bräuchten zweiten Mechanismus; nur `texts` ohne Locale-Begriff |
| Zahlen/Platzhalter         | Strings mit `{platzhalter}`, Plural als Objekt via `Intl.PluralRules` | Funktionen (Locale nicht mehr reine Daten, jede Übersetzung baut Pluralregeln nach); neutrale Formulierung ohne Plural                  |
| `uploadImage.texts`        | **ersatzlos entfernt**                                                | als deprecated weiterführen                                                                                                             |
| Sprachwechsel zur Laufzeit | nein — gilt ab Konstruktor                                            | `setLocale()` (später ohne Breaking Change nachrüstbar)                                                                                 |
| Externe i18n-Bibliothek    | nein — ~45 Texte rechtfertigen keine Abhängigkeit                     | i18next o. ä.                                                                                                                           |

## Öffentliche API

### Typen (exportiert aus `supamde`)

```ts
/** Pluralformen nach CLDR; `other` ist Pflicht und Rückfall für fehlende Formen. */
export interface PluralText {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export interface LocaleTexts {
  // Toolbar: ein Schlüssel pro Built-in-Aktion, Suffix = Aktionsname
  'toolbar.bold': string;
  'toolbar.italic': string;
  // … alle Built-in-Aktionen aus BUILTIN_ACTIONS (heute 29)

  // Statusbar
  'status.lines': PluralText; // {count}
  'status.words': PluralText; // {count}
  'status.autosaved': string; // {time}

  // Bild-Upload (ersetzt UploadTexts)
  'upload.placeholder': string; // {name}
  'upload.statusInit': string;
  'upload.statusUploading': string; // {name}
  'upload.statusDone': string; // {name}
  'upload.errorTooLarge': string; // {name}, {maxSize}
  'upload.errorType': string; // {name}
  'upload.errorFailed': string; // {name}

  // In das Dokument eingefügter Text
  'table.column': string; // {n} → Spaltenüberschrift der Tabellenvorlage
}

export interface Locale {
  /** BCP-47-Code; steuert Pluralregeln und Uhrzeitformat. */
  code: string;
  texts: LocaleTexts;
}
```

**Flache Schlüssel mit Punkt-Präfix** statt verschachtelter Gruppen: `texts` kommt
mit `Partial<LocaleTexts>` aus (kein DeepPartial), und die Toolbar-Schlüssel
entsprechen 1:1 den Aktionsnamen (`toolbar.${name}`) — keine zweite Namensliste.

### Exporte

- `en`, `de` — die mitgelieferten Locales (`Locale`).
- Typen `Locale`, `LocaleTexts`, `PluralText`.
- **Entfällt:** Typ `UploadTexts`.

### Optionen (`SupaMDEOptions`)

```ts
/** Sprache der UI-Texte (Default: en). */
locale?: Locale;
/** Überschreibt einzelne Texte; Vorrang vor `locale`. */
texts?: Partial<LocaleTexts>;
```

**Entfällt:** `uploadImage.texts`.

### Nutzung

```js
import SupaMDE, { de } from 'supamde';

new SupaMDE({ element }); // Englisch
new SupaMDE({ element, locale: de }); // Deutsch
new SupaMDE({ element, locale: de, texts: { 'toolbar.bold': 'Fettdruck' } });
```

Eine eigene Sprache ist ein weiteres Objekt derselben Form:

```ts
import type { Locale } from 'supamde';

const fr: Locale = { code: 'fr', texts: { 'toolbar.bold': 'Gras' /* … */ } };
```

### Rangfolge pro Schlüssel

`texts` → `locale.texts` → `en.texts`

Der Rückfall auf `en` ist ein Laufzeit-Sicherheitsnetz für JavaScript-Nutzer mit
unvollständigen eigenen Locales. Für TypeScript-Nutzer verlangt `Locale` alle
Schlüssel, damit Übersetzer keinen vergessen.

### `code` und `Intl`

- **Plural:** `new Intl.PluralRules(code).select(count)` wählt die Form; fehlt
  sie im `PluralText`, gilt `other`.
- **Uhrzeit im Autosave-Status:** `new Intl.DateTimeFormat(code, { hour: '2-digit',
minute: '2-digit' })` statt bisher der Browser-Locale — die Uhrzeit passt so zur
  gewählten Sprache (`en`: „Saved: 02:05 PM", `de`: „Gespeichert: 14:05").

## Architektur

### Neues Modul `src/i18n/`

| Datei           | Inhalt                                                                    |
| --------------- | ------------------------------------------------------------------------- |
| `types.ts`      | `PluralText`, `LocaleTexts`, `Locale`                                     |
| `en.ts`         | `export const en: Locale` — reine Daten                                   |
| `de.ts`         | `export const de: Locale` — reine Daten (heutige Texte, mit Pluralformen) |
| `translator.ts` | `createTranslator(locale?, texts?): Translator`                           |
| `facet.ts`      | `translatorFacet` — CM6-Facet mit Default `createTranslator()`            |

```ts
export interface Translator {
  /** Effektiver Locale-Code (nach Gültigkeitsprüfung). */
  readonly code: string;
  /** Einfacher Text mit Platzhaltern. */
  t(key: SimpleTextKey, params?: Record<string, string>): string;
  /** Pluralform zu `count`; setzt `{count}` und weitere Platzhalter ein. */
  plural(key: PluralTextKey, count: number, params?: Record<string, string>): string;
  /** Uhrzeit HH:MM im Format des Locale-Codes. */
  formatTime(date: Date): string;
}
```

`SimpleTextKey` / `PluralTextKey` sind die Schlüssel von `LocaleTexts`, deren Wert
`string` bzw. `PluralText` ist — `t('status.lines')` ist damit ein Typfehler.

`createTranslator` führt die drei Ebenen **einmal** zu einem vollständigen
Textobjekt zusammen und erzeugt `Intl.PluralRules` und `Intl.DateTimeFormat`
einmal (nicht pro Aufruf — `plural` läuft bei jeder Dokumentänderung).
Platzhalter ersetzt das vorhandene `formatText` aus `util/text-format.ts`.

### Weitergabe

Der Konstruktor in `index.ts` erzeugt den Translator einmal aus
`options.locale` / `options.texts` und reicht ihn weiter:

| Empfänger                                          | Heute                                    | Künftig                                                                           |
| -------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| `createToolbar` (`ui/toolbar.ts`)                  | `action.title` aus der globalen Registry | `t(\`toolbar.${name}\`)`; Feld `title`entfällt aus`ToolbarAction`                 |
| `createStatusbar` (`ui/statusbar.ts`)              | fest „Zeilen"/„Wörter"                   | `plural('status.lines', n)` / `plural('status.words', n)`                         |
| Autosave-Callback (`index.ts`)                     | fest „Gespeichert:", Browser-Locale      | `t('status.autosaved', { time: formatTime(date) })`                               |
| `createImageUploader` (`features/image-upload.ts`) | `resolveUploadTexts(options.texts)`      | Translator; `UploadTexts`, `DEFAULT_UPLOAD_TEXTS`, `resolveUploadTexts` entfallen |
| Tabellen-Command (`commands/table.ts`)             | fester String                            | `view.state.facet(translatorFacet).t('table.column', { n })`                      |
| Extensions (`editor/extensions.ts`)                | —                                        | `translatorFacet.of(translator)`                                                  |

Die Tooltip-Zusammensetzung „Titel (Kürzel)" in `ui/toolbar.ts` bleibt unverändert;
nur die Quelle des Titels ändert sich.

**Warum eine Facet für Commands:** Commands sind reine `(view) => boolean`-Funktionen
ohne Zugriff auf die Editor-Instanz. Eine Facet ist der idiomatische CM6-Weg,
Konfiguration in den State zu legen; Commands bleiben ohne Instanz testbar. Der
Facet-Default (`createTranslator()`, also `en`) sorgt dafür, dass Commands auch in
Unit-Tests ohne SupaMDE-Instanz funktionieren.

### Unverändert

- **Custom-Buttons** behalten ihr eigenes `title`; die Übersetzung liegt beim Host.
- **Custom-Statusbar-Items** liefern ihren Text selbst.
- **Tastenkürzel-Beschriftungen** (`Ctrl+B`, `⌘B`) sind bereits sprachneutral.
- **`formatBytes`** (`2 MB`) — Einheiten sind sprachübergreifend lesbar.
- Die Option `placeholder` (Platzhaltertext im leeren Editor) liefert der Host.

### Entwicklermeldungen

Die 6 `console.warn` und 2 `Error`-Meldungen werden direkt auf Englisch
umgeschrieben (Präfix `SupaMDE:` bleibt). Sie laufen **nicht** über den Translator.

## Fehlerverhalten

Gleiches Muster wie `resolveEditorMode`: kein Wurf, der Editor startet immer.

| Fall                                          | Verhalten                                                     |
| --------------------------------------------- | ------------------------------------------------------------- |
| Schlüssel fehlt in `locale.texts`             | stiller Rückfall auf `en`                                     |
| Unbekannter Schlüssel in `texts`              | ignoriert (TypeScript meldet den Tippfehler)                  |
| Ungültiger `code` (`Intl` wirft `RangeError`) | einmal `console.warn`, Pluralregeln und Zeitformat mit `'en'` |
| Pluralform fehlt im `PluralText`              | `other`                                                       |
| Platzhalter ohne Wert, z. B. `{foo}`          | bleibt als Text stehen (bestehendes `formatText`-Verhalten)   |

## Tests

Unit-Ebene (jsdom), TDD. Keine neuen Browser-Tests — Texte haben keinen Einfluss
auf Layout oder Geometrie.

**Vollständigkeit**

- `de.texts` hat exakt die Schlüssel von `en.texts`; Plural-Schlüssel sind in
  beiden `PluralText`.
- Jede Aktion in `BUILTIN_ACTIONS` hat einen `toolbar.*`-Schlüssel in `en`, und
  jeder `toolbar.*`-Schlüssel gehört zu einer Aktion — eine neue Aktion ohne
  Übersetzung schlägt fehl.

**Translator**

- Rangfolge `texts` → `locale` → `en`, inklusive unvollständiger Locale.
- Platzhalter in `t` und `plural`.
- Pluralformen: `en` 1/2, `de` 1/2, eine Locale mit `few` (z. B. `pl`: 2 → `few`),
  Rückfall auf `other` bei fehlender Form.
- Ungültiger `code` → eine Warnung, Rückfall auf `'en'`.
- `formatTime` nutzt den Locale-Code.

**Integration**

- Tooltip und `aria-label` der Built-in-Buttons: englisch per Default, deutsch mit
  `locale: de`, einzelner Text über `texts` überschrieben.
- Statusbar: „1 line" / „2 lines"; mit `de` „1 Zeile" / „2 Zeilen".
- Autosave-Status: Text aus `status.autosaved`.
- Tabellenvorlage: `Column 1 | Column 2` per Default, `Spalte 1 | Spalte 2` mit `de`.
- Upload: Platzhalter und Statusmeldungen aus den `upload.*`-Schlüsseln, englisch
  per Default.

**Bestehende Tests**, die deutsche Texte prüfen (u. a. Statusbar, Toolbar-Titel,
Upload-Texte, Tabelle, Autosave), werden auf den englischen Default umgestellt
oder setzen `locale: de` explizit. Tests auf `uploadImage.texts` und
`resolveUploadTexts` entfallen bzw. wandern auf `texts`.

## Dokumentation

- README: neuer Abschnitt **Localization** — `de` aktivieren, einzelne Texte über
  `texts` überschreiben, eigene Locale als Beispiel, Hinweis auf `code`
  (Plural, Uhrzeit).
- README: Hinweis „UI-Texte sind deutsch" am Anfang entfällt.
- README: „Customizing display texts" beim Bild-Upload verweist auf `texts` mit den
  `upload.*`-Schlüsseln; die Optionstabelle verliert die Zeile `texts`.
- README: Autosave-Statusbar-Beschreibung auf „Saved: HH:MM" umstellen.

## Breaking Changes

Vor dem ersten npm-Release; betrifft nur Nutzer des Git-Installs:

- Default-Sprache der UI-Texte ist Englisch (vorher Deutsch) → `locale: de` setzen.
- Option `uploadImage.texts` entfällt → `texts` mit `upload.*`-Schlüsseln.
- Typ-Export `UploadTexts` entfällt.
- Uhrzeit im Autosave-Status folgt dem Locale-Code statt der Browser-Locale.

## Nicht enthalten

- Sprachwechsel zur Laufzeit (`setLocale`) — später ohne Breaking Change nachrüstbar.
- Automatische Spracherkennung über `navigator.language`.
- Weitere mitgelieferte Sprachen außer `en` und `de`.
- Übersetzung von Vorschau-Inhalten oder Markdown.
- Rechts-nach-links-Schrift (RTL).
- Übersetzung der Entwicklermeldungen.
