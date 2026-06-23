import type {Data} from '@dnd-kit/abstract';
import type {DroppableInput} from '@dnd-kit/dom';
import {Droppable} from '@dnd-kit/dom';
import {createEffect, createSignal} from 'solid-js';

import {useDeepSignal} from '../../hooks/useDeepSignal.ts';
import {useInstance} from '../hooks/useInstance.ts';

let placeholderId = 0;

export interface UseDroppableInput<T extends Data = Data>
  extends Omit<DroppableInput<T>, 'element'> {
  element?: Element;
}

export function useDroppable<T extends Data = Data>(
  input: UseDroppableInput<T>
) {
  const droppable = useInstance(
    (manager) =>
      new Droppable(
        {
          id: createPlaceholderId(),
          register: false,
        },
        manager
      )
  );
  const trackedDroppable = useDeepSignal(() => droppable);

  const [element, setElement] = createSignal<Element | undefined>();

  createEffect(
    () => ({
      accept: input.accept,
      collisionDetector: input.collisionDetector,
      data: input.data,
      disabled: input.disabled ?? false,
      element: element() ?? input.element,
      id: input.id,
      type: input.type,
    }),
    (options) => {
      droppable.element = options.element;
      droppable.id = options.id;
      droppable.accept = options.accept;
      droppable.type = options.type;
      droppable.disabled = options.disabled;

      if (options.collisionDetector) {
        droppable.collisionDetector = options.collisionDetector;
      }

      if (options.data) {
        droppable.data = options.data;
      }
    }
  );

  return {
    get droppable() {
      return droppable;
    },
    isDropTarget: () => trackedDroppable().isDropTarget,
    ref: setElement,
  };
}

function createPlaceholderId() {
  placeholderId += 1;

  return `__dnd-kit-solid-droppable-${placeholderId}`;
}
