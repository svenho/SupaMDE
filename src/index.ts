import { VERSION } from './version';

/** Konfigurationsoptionen für SupaMDE. Wird in späteren Meilensteinen erweitert. */
export interface SupaMDEOptions {
  /** Das Textarea-Element, an das der Editor gebunden wird. */
  element?: HTMLElement | null;
}

/**
 * SupaMDE — moderner Markdown-Editor auf Basis von CodeMirror 6.
 *
 * In M0 ist dies bewusst nur ein Skelett: Der Konstruktor nimmt Optionen
 * entgegen und legt sie ab. Die Editor-Erzeugung (EditorView) folgt in M1.
 */
export class SupaMDE {
  /** Aktuelle SupaMDE-Version. */
  static readonly version = VERSION;

  /** Die (aktuell unveränderten) Optionen dieser Instanz. */
  readonly options: SupaMDEOptions;

  constructor(options: SupaMDEOptions = {}) {
    this.options = options;
  }
}

export { VERSION } from './version';
export default SupaMDE;
