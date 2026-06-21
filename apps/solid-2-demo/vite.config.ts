import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {defineConfig} from 'vite';
import solid from 'vite-plugin-solid';

const require = createRequire(import.meta.url);
const solidWebRuntimeCompat = new URL(
  './src/solid-web-runtime.ts',
  import.meta.url
).pathname;
const solidSignalsRuntime = packageFile('@solidjs/signals', 'dist/prod.js');
const solidRuntime = packageFile('solid-js', 'dist/solid.js');
const solidWebRuntime = packageFile('@solidjs/web', 'dist/web.js');

function packageFile(specifier: string, file: string) {
  return join(dirname(dirname(require.resolve(specifier))), file);
}

export default defineConfig({
  plugins: [
    solid({
      dev: false,
      hot: false,
      solid: {
        moduleName: solidWebRuntimeCompat,
      },
    }),
  ],
  resolve: {
    alias: [
      {find: '@solidjs/signals', replacement: solidSignalsRuntime},
      {find: 'solid-js/web', replacement: solidWebRuntimeCompat},
      {find: 'solid-js/store', replacement: solidRuntime},
      {find: 'solid-js', replacement: solidRuntime},
      {find: '@solidjs/web', replacement: solidWebRuntime},
    ],
  },
  optimizeDeps: {
    exclude: ['@dnd-kit/abstract', '@dnd-kit/dom', '@dnd-kit/solid'],
  },
});
