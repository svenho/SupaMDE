import type { Locale } from './types';

/** Englisch — Default-Sprache und Rückfall für fehlende Schlüssel. Reine Daten. */
export const en: Locale = {
  code: 'en',
  texts: {
    'toolbar.bold': 'Bold',
    'toolbar.italic': 'Italic',
    'toolbar.strikethrough': 'Strikethrough',
    'toolbar.code': 'Inline code',
    'toolbar.heading-smaller': 'Smaller heading',
    'toolbar.heading-bigger': 'Bigger heading',
    'toolbar.heading-1': 'Heading 1',
    'toolbar.heading-2': 'Heading 2',
    'toolbar.heading-3': 'Heading 3',
    'toolbar.heading-4': 'Heading 4',
    'toolbar.heading-5': 'Heading 5',
    'toolbar.heading-6': 'Heading 6',
    'toolbar.quote': 'Blockquote',
    'toolbar.code-block': 'Code block',
    'toolbar.horizontal-rule': 'Horizontal rule',
    'toolbar.clean-block': 'Clear formatting',
    'toolbar.unordered-list': 'Bulleted list',
    'toolbar.ordered-list': 'Numbered list',
    'toolbar.check-list': 'Checklist',
    'toolbar.link': 'Link',
    'toolbar.image': 'Image',
    'toolbar.table': 'Table',
    'toolbar.undo': 'Undo',
    'toolbar.redo': 'Redo',
    'toolbar.side-by-side': 'Side-by-side preview',
    'toolbar.fullscreen': 'Fullscreen',
    'toolbar.preview-fullscreen': 'Fullscreen preview',
    'toolbar.editor-mode': 'Live preview',
    'toolbar.upload-image': 'Upload image',

    'status.lines': { one: '{count} line', other: '{count} lines' },
    'status.words': { one: '{count} word', other: '{count} words' },
    'status.autosaved': 'Saved: {time}',

    'upload.placeholder': '![Uploading {name}…]()',
    'upload.statusInit': 'Drag an image here or paste it',
    'upload.statusUploading': 'Uploading {name}…',
    'upload.statusDone': '{name} uploaded',
    'upload.errorTooLarge': '{name} is too large (max. {maxSize}).',
    'upload.errorType': '{name} is not a supported image format.',
    'upload.errorFailed': 'Upload of {name} failed.',

    'prompt.linkUrl': 'Link URL:',
    'prompt.imageUrl': 'Image URL:',

    'table.column': 'Column {n}',
  },
};
