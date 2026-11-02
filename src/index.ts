import './styles.css';
import type { ExtensionContext, PanelExport } from '@nimbalyst/extension-sdk';
import { ResonancePanel } from './ResonancePanel';
import { setConfiguration } from './settings';
import { setUi } from './notify';

export const panels: Record<string, PanelExport> = {
  spec: { component: ResonancePanel },
};

export function activate(context: ExtensionContext) {
  setConfiguration(context.services.configuration);
  setUi(context.services.ui);
}

export function deactivate() {
  setConfiguration(undefined);
  setUi(undefined);
}
