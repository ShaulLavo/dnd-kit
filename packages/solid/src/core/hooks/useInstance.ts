import type {DragDropManager} from '@dnd-kit/dom';
import type {CleanupFunction} from '@dnd-kit/state';
import {createEffect} from 'solid-js';

import {useDragDropManager} from './useDragDropManager.ts';

export interface Instance<T extends DragDropManager = DragDropManager> {
  manager: T | undefined;
  register(): CleanupFunction | void;
}

export function useInstance<T extends Instance>(
  initializer: (manager: DragDropManager | undefined) => T
): T {
  const manager = useDragDropManager() ?? undefined;
  const instance = initializer(manager);

  createEffect(
    () => manager,
    (_manager) => {
      instance.manager = _manager;

      return deferRegister(instance);
    }
  );

  return instance;
}

function deferRegister(instance: Instance): CleanupFunction {
  let cleanup: CleanupFunction | void;
  let disposed = false;

  queueMicrotask(() => {
    if (disposed) return;

    cleanup = instance.register();
  });

  return () => {
    disposed = true;
    cleanup?.();
  };
}
