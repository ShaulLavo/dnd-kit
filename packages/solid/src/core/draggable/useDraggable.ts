import type {Data} from '@dnd-kit/abstract';
import type {DraggableInput} from '@dnd-kit/dom';
import {Draggable} from '@dnd-kit/dom';
import {createEffect, createSignal} from 'solid-js';

import {useDeepSignal} from '../../hooks/useDeepSignal.ts';
import {useInstance} from '../hooks/useInstance.ts';

export interface UseDraggableInput<T extends Data = Data>
  extends Omit<DraggableInput<T>, 'handle' | 'element'> {
  handle?: Element;
  element?: Element;
}

export function useDraggable<T extends Data = Data>(
  input: UseDraggableInput<T>
) {
  const draggable = useInstance(
    (manager) =>
      new Draggable(
        {
          ...input,
          register: false,
          element: input.element,
          handle: input.handle,
        },
        manager
      )
  );
  const trackedDraggable = useDeepSignal(() => draggable);

  const [element, setElement] = createSignal<Element | undefined>(
    input.element
  );
  const [handle, setHandle] = createSignal<Element | undefined>(input.handle);

  createEffect(
    () => ({
      alignment: input.alignment,
      data: input.data,
      disabled: input.disabled ?? false,
      element: element(),
      handle: handle(),
      id: input.id,
      modifiers: input.modifiers,
      plugins: input.plugins,
      sensors: input.sensors,
    }),
    (options) => {
      if (options.element) draggable.element = options.element;
      if (options.handle) draggable.handle = options.handle;

      draggable.id = options.id;
      draggable.disabled = options.disabled;
      draggable.alignment = options.alignment;
      draggable.plugins = options.plugins;
      draggable.modifiers = options.modifiers;
      draggable.sensors = options.sensors;

      if (options.data) {
        draggable.data = options.data;
      }
    }
  );

  return {
    get draggable() {
      return draggable;
    },
    isDragging: () => trackedDraggable().isDragging,
    isDropping: () => trackedDraggable().isDropping,
    isDragSource: () => trackedDraggable().isDragSource,
    ref: setElement,
    handleRef: setHandle,
  };
}
