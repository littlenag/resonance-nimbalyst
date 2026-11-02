import { nimbalystPreset } from '@nimbalyst/extension-sdk/tailwind';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [nimbalystPreset],
  content: ['./src/**/*.{ts,tsx}'],
  // The stylesheet is global in Nimbalyst's window: no reset, and every utility is
  // scoped to the panel's root so nothing leaks into the host.
  important: '.rn-root',
  corePlugins: { preflight: false },
};
