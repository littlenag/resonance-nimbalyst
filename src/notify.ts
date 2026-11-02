// Short messages through Nimbalyst's own notifications (ExtensionUIService), as the web UI
// shows Mantine notifications.

import type { ExtensionUIService } from '@nimbalyst/extension-sdk';

let ui: ExtensionUIService | undefined;

export function setUi(service: ExtensionUIService | undefined) {
  ui = service;
}

export const notify = {
  info(message: string) {
    if (ui) ui.showInfo(message);
    else console.info('[Resonance]', message);
  },
  error(title: string, message: string) {
    const text = `${title}: ${message}`;
    if (ui) ui.showError(text);
    else console.error('[Resonance]', text);
  },
};
