import { defineConfig } from 'vite';
import { createExtensionConfig, mergeExtensionConfig } from '@nimbalyst/extension-sdk/vite';

const base = createExtensionConfig({
  entry: './src/index.ts',
});

export default defineConfig(
  mergeExtensionConfig(base, {
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          // TanStack Query marks its modules "use client" for server-component frameworks.
          // The directive means nothing in this bundle, and Rollup drops it, then fails to map
          // that warning back to a source line. Neither is a problem; other warnings still show.
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' || warning.code === 'SOURCEMAP_ERROR') return;
          warn(warning);
        },
      },
    },
  }),
);
