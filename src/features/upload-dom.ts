import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/**
 * Die Bilddateien aus einem DataTransfer. Nicht-Bilder werden hier bereits
 * ausgesiebt: Ein Drop mit einem PDF darf NICHT als Bild-Upload gelten und soll
 * ungestört den Standardweg gehen.
 */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = data.files;
  if (!files || files.length === 0) return [];
  return Array.from(files).filter((f) => f.type.startsWith('image/'));
}

/**
 * Drop- und Paste-Handler. Greift NUR ein, wenn Bilddateien im Spiel sind —
 * reiner Text-Drop und Text-Paste laufen unverändert durch den CM6-Standardweg.
 */
export function uploadDropPasteExtension(onFiles: (files: File[]) => void): Extension {
  return EditorView.domEventHandlers({
    drop(event) {
      const files = imageFilesFrom(event.dataTransfer);
      if (files.length === 0) return false;
      event.preventDefault();
      onFiles(files);
      return true;
    },
    paste(event) {
      const files = imageFilesFrom(event.clipboardData);
      if (files.length === 0) return false;
      event.preventDefault();
      onFiles(files);
      return true;
    },
  });
}

/**
 * Öffnet die Dateiauswahl über einen bei Bedarf erzeugten, versteckten Input.
 *
 * Bewusst NICHT in der Toolbar geparkt: So funktioniert `openBrowseFileWindow()`
 * auch bei `toolbar: false` — bei easyMDE warf derselbe Aufruf ohne Toolbar
 * einen Fehler, weil der Input am Toolbar-DOM hing.
 */
export function openFilePicker(accept: string[], onFiles: (files: File[]) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = accept.join(',');
  input.style.display = 'none';

  const aufräumen = (): void => {
    input.remove();
  };

  input.addEventListener('change', () => {
    const files = input.files ? Array.from(input.files) : [];
    aufräumen();
    if (files.length > 0) onFiles(files);
  });

  // Bricht der Nutzer den Systemdialog ab, feuert `change` NICHT — ohne diesen
  // Listener bliebe der Input für immer im Body hängen und sammelte sich bei
  // jedem weiteren Klick auf den Toolbar-Button an. `cancel` ist in Firefox erst
  // ab 109 und in Safari erst ab 16.4 verfügbar; wo es fehlt, bleibt genau ein
  // leerer, versteckter Input pro Abbruch liegen — unschön, aber folgenlos, und
  // die Alternative (ein `focus`-Handler auf `window` mit Zeitfenster-Heuristik)
  // wäre für den Gewinn zu viel Maschinerie.
  input.addEventListener('cancel', aufräumen);

  document.body.appendChild(input);
  input.click();
}
