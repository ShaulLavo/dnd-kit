import {readFileSync} from 'fs';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import {mergeConfig} from 'vite';
import solid from 'vite-plugin-solid';

import type {PluginOption} from 'vite';

const sharedPreviewHead = readFileSync(
  join(__dirname, '..', '..', 'stories-shared', 'preview-head.html'),
  'utf-8'
);
const require = createRequire(import.meta.url);
const solidRuntimeCompat = new URL(
  './solid-runtime.ts',
  import.meta.url
).pathname;
const solidWebRuntimeCompat = new URL(
  './solid-web-runtime.ts',
  import.meta.url
).pathname;
const solidSignalsRuntime = packageFile('@solidjs/signals', 'dist/prod.js');
const solidRuntime = packageFile('solid-js', 'dist/solid.js');
const solidWebRuntime = packageFile('@solidjs/web', 'dist/web.js');
const solidWebServerRuntime = packageFile('@solidjs/web', 'dist/server.js');

export default {
  previewHead: (head: string) => `${sharedPreviewHead}\n${head}`,
  stories: ['../stories/**/*.stories.tsx'],

  addons: [
    getAbsolutePath('@storybook/addon-links'),
    getAbsolutePath('@vueless/storybook-dark-mode'),
    getAbsolutePath('@dnd-kit/storybook-addon-codesandbox'),
  ],

  framework: {
    name: getAbsolutePath('storybook-solidjs-vite'),
    options: {},
  },

  async viteFinal(config) {
    const plugins = (config.plugins ?? []).filter((plugin) => {
      return !isSolidPlugin(plugin);
    });
    const baseConfig = {...config, plugins};

    return mergeConfig(baseConfig, {
      define: {
        'process.env': {},
      },
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
          {find: 'solid-js/server', replacement: solidWebServerRuntime},
          {find: 'solid-js/web', replacement: solidWebRuntimeCompat},
          {find: 'solid-js/store', replacement: solidRuntime},
          {find: 'solid-js', replacement: solidRuntimeCompat},
          {find: '@solidjs/web', replacement: solidWebRuntime},
        ],
      },
      optimizeDeps: {
        exclude: ['@dnd-kit/*'],
      },
    });
  },
};

function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, 'package.json')));
}

function packageFile(specifier: string, file: string) {
  return join(dirname(dirname(require.resolve(specifier))), file);
}

function isSolidPlugin(plugin: PluginOption): boolean {
  if (!plugin || typeof plugin === 'string') return false;
  if (Array.isArray(plugin)) return plugin.some(isSolidPlugin);
  if (typeof plugin === 'function') return false;

  return plugin.name === 'vite-plugin-solid';
}
