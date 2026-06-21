export * from '@solidjs/web';

import {createRenderEffect} from 'solid-js';

export function effect(fn, value) {
  createRenderEffect(
    () => fn(value),
    (next) => {
      value = next;
    }
  );
}

export function use(fn, node, arg) {
  return fn(node, arg);
}
