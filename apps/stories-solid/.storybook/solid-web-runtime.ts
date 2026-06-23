export * from '@solidjs/web';

import {createRenderEffect} from 'solid-js';

export function effect<T>(fn: (previous?: T) => T, value?: T) {
  createRenderEffect(
    () => fn(value),
    (next) => {
      value = next;
    }
  );
}

export function use<Arg, Ret>(
  fn: (node: Element, arg: Arg | undefined) => Ret,
  node: Element,
  arg?: Arg
) {
  return fn(node, arg);
}
