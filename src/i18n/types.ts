/** Pluralformen nach CLDR; `other` ist Pflicht und Rückfall für fehlende Formen. */
export interface PluralText {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

/**
 * Alle Texte, die Endnutzer sehen. Flache Schlüssel mit Punkt-Präfix statt
 * verschachtelter Gruppen: `texts` kommt so mit `Partial<LocaleTexts>` aus (kein
 * DeepPartial), und die Toolbar-Schlüssel entsprechen 1:1 den Aktionsnamen aus
 * `BUILTIN_ACTIONS` (`toolbar.${name}`) — keine zweite Namensliste. Dass beide
 * Listen übereinstimmen, prüft `i18n/__tests__/locales.test.ts`.
 */
export interface LocaleTexts {
  // Toolbar: Tooltip und aria-label der Built-in-Buttons
  'toolbar.bold': string;
  'toolbar.italic': string;
  'toolbar.strikethrough': string;
  'toolbar.code': string;
  'toolbar.heading-smaller': string;
  'toolbar.heading-bigger': string;
  'toolbar.heading-1': string;
  'toolbar.heading-2': string;
  'toolbar.heading-3': string;
  'toolbar.heading-4': string;
  'toolbar.heading-5': string;
  'toolbar.heading-6': string;
  'toolbar.quote': string;
  'toolbar.code-block': string;
  'toolbar.horizontal-rule': string;
  'toolbar.clean-block': string;
  'toolbar.unordered-list': string;
  'toolbar.ordered-list': string;
  'toolbar.check-list': string;
  'toolbar.link': string;
  'toolbar.image': string;
  'toolbar.table': string;
  'toolbar.undo': string;
  'toolbar.redo': string;
  'toolbar.side-by-side': string;
  'toolbar.fullscreen': string;
  'toolbar.preview-fullscreen': string;
  'toolbar.editor-mode': string;
  'toolbar.upload-image': string;

  // Statusbar
  /** Platzhalter: `{count}`. */
  'status.lines': PluralText;
  /** Platzhalter: `{count}`. */
  'status.words': PluralText;
  /** Platzhalter: `{time}`. */
  'status.autosaved': string;

  // Bild-Upload
  /** In das Dokument eingefügter Platzhalter. Platzhalter: `{name}`. */
  'upload.placeholder': string;
  'upload.statusInit': string;
  /** Platzhalter: `{name}`. */
  'upload.statusUploading': string;
  /** Platzhalter: `{name}`. */
  'upload.statusDone': string;
  /** Platzhalter: `{name}`, `{maxSize}`. */
  'upload.errorTooLarge': string;
  /** Platzhalter: `{name}`. */
  'upload.errorType': string;
  /** Platzhalter: `{name}`. */
  'upload.errorFailed': string;

  // Eingabedialoge der Link-/Bild-Aktionen (window.prompt)
  'prompt.linkUrl': string;
  'prompt.imageUrl': string;

  // In das Dokument eingefügter Text
  /** Spaltenüberschrift der Tabellenvorlage. Platzhalter: `{n}`. */
  'table.column': string;
}

/** Eine Sprache: BCP-47-Code plus vollständiger Textsatz. */
export interface Locale {
  /** BCP-47-Code; steuert Pluralregeln und Uhrzeitformat. */
  code: string;
  texts: LocaleTexts;
}

/** Die Schlüssel von `LocaleTexts`, deren Wert ein `PluralText` ist. */
export type PluralTextKey = {
  [K in keyof LocaleTexts]: LocaleTexts[K] extends PluralText ? K : never;
}[keyof LocaleTexts];

/** Die Schlüssel von `LocaleTexts`, deren Wert ein einfacher String ist. */
export type SimpleTextKey = Exclude<keyof LocaleTexts, PluralTextKey>;
