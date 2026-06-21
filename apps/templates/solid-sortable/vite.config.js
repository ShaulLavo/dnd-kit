import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

const require = createRequire(import.meta.url);
const solidSignalsRuntime = packageFile('@solidjs/signals', 'dist/prod.js');
const solidWebRuntime = new URL('./src/solid-web-runtime.ts', import.meta.url)
  .pathname;

function packageFile(specifier, file) {
  return join(dirname(dirname(require.resolve(specifier))), file);
}

export default defineConfig({
  plugins: [
    solid({
      solid: {
        moduleName: solidWebRuntime,
      },
    }),
  ],
  resolve: {
    alias: [
      {find: '@solidjs/signals', replacement: solidSignalsRuntime},
    ],
  },
});
