import {
  createElement,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading,
  Quote,
  SquareCode,
  Minus,
  Eraser,
  List,
  ListOrdered,
  ListChecks,
  Link,
  Image,
  Table,
  Undo,
  Redo,
  type IconNode,
} from 'lucide';

/**
 * Mapping Built-in-Icon-Name → Lucide-Icon-Daten. Die Namen sind die von der
 * Toolbar-Registry (`ui/actions.ts`) verwendeten Built-in-Schlüssel.
 */
const ICONS: Record<string, IconNode> = {
  bold: Bold,
  italic: Italic,
  strikethrough: Strikethrough,
  code: Code,
  heading: Heading,
  quote: Quote,
  'code-block': SquareCode,
  'horizontal-rule': Minus,
  'clean-block': Eraser,
  'unordered-list': List,
  'ordered-list': ListOrdered,
  'check-list': ListChecks,
  link: Link,
  image: Image,
  table: Table,
  undo: Undo,
  redo: Redo,
};

/** Ob ein Icon-Name bekannt ist. */
export function hasIcon(name: string): boolean {
  return name in ICONS;
}

/** Liefert ein fertiges Lucide-SVGElement für `name`; wirft bei unbekanntem Namen. */
export function renderIcon(name: string): SVGElement {
  const data = ICONS[name];
  if (!data) {
    throw new Error(`SupaMDE: unbekanntes Icon "${name}".`);
  }
  return createElement(data);
}
