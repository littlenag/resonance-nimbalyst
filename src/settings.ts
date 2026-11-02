// The extension's settings (the configuration service handed to activate()) and the
// panel's storage (PanelHost.storage), reachable from any component.

import type { ExtensionConfigurationService, ExtensionStorage } from '@nimbalyst/extension-sdk';
import { DEFAULT_BINARY } from './resonance';

let configuration: ExtensionConfigurationService | undefined;
let storage: ExtensionStorage | undefined;

export function setConfiguration(service: ExtensionConfigurationService | undefined) {
  configuration = service;
}

export function getBinaryPath(): string {
  return configuration?.get<string>('binaryPath', DEFAULT_BINARY) ?? DEFAULT_BINARY;
}

export function setStorage(s: ExtensionStorage | undefined) {
  storage = s;
}

export function getStorage(): ExtensionStorage | undefined {
  return storage;
}
