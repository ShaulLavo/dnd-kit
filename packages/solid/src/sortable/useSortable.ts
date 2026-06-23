import {type Data} from '@dnd-kit/abstract';
import {Feedback, type FeedbackInput} from '@dnd-kit/dom';
import type {SortableInput} from '@dnd-kit/dom/sortable';
import {defaultSortableTransition, Sortable} from '@dnd-kit/dom/sortable';
import {batch} from '@dnd-kit/state';
import {createEffect, createSignal} from 'solid-js';

import {useDeepSignal} from '@dnd-kit/solid/hooks';
import {useInstance} from '@dnd-kit/solid';

let placeholderId = 0;

export interface UseSortableInput<T extends Data = Data>
  extends Omit<SortableInput<T>, 'handle' | 'element' | 'source' | 'target'> {
  feedback?: FeedbackInput;
  handle?: Element;
  element?: Element;
  source?: Element;
  target?: Element;
}

export function useSortable<T extends Data = Data>(input: UseSortableInput<T>) {
  const sortable = useInstance((manager) => {
    return new Sortable(
      {
        id: createPlaceholderId(),
        index: 0,
        register: false,
      },
      manager
    );
  });
  const trackedSortable = useDeepSignal(() => sortable);

  const [element, setElement] = createSignal<Element | undefined>();
  const [handle, setHandle] = createSignal<Element | undefined>();
  const [source, setSource] = createSignal<Element | undefined>();
  const [target, setTarget] = createSignal<Element | undefined>();

  createEffect(
    () => ({
      accept: input.accept,
      alignment: input.alignment,
      collisionDetector: input.collisionDetector,
      collisionPriority: input.collisionPriority,
      data: input.data,
      disabled: input.disabled ?? false,
      element: element() ?? input.element,
      handle: handle() ?? input.handle,
      id: input.id,
      modifiers: input.modifiers,
      feedback: input.feedback,
      plugins: input.plugins,
      sensors: input.sensors,
      source: source() ?? input.source,
      target: target() ?? input.target,
      transition: input.transition,
      type: input.type,
    }),
    (options) => {
      sortable.source = options.source;
      sortable.target = options.target;
      sortable.element = options.element;
      sortable.handle = options.handle;
      sortable.id = options.id;
      sortable.disabled = options.disabled;
      sortable.alignment = options.alignment;
      sortable.plugins = withFeedbackPlugin(options.plugins, options.feedback);
      sortable.modifiers = options.modifiers;
      sortable.sensors = options.sensors;
      sortable.accept = options.accept;
      sortable.type = options.type;
      sortable.collisionPriority = options.collisionPriority;
      sortable.transition = options.transition
        ? {...defaultSortableTransition, ...options.transition}
        : defaultSortableTransition;

      if (options.collisionDetector) {
        sortable.collisionDetector = options.collisionDetector;
      }

      if (options.data) {
        sortable.data = options.data;
      }
    }
  );

  // Batch group + index updates
  createEffect(
    () => ({
      group: input.group,
      index: input.index,
    }),
    ({group, index}) => {
      batch(() => {
        sortable.group = group;
        sortable.index = index;
      });
    }
  );

  // Refresh shape when index changes while idle
  createEffect(
    () => input.index,
    () => {
      if (!sortable.manager?.dragOperation.status.idle) return;
      if (!sortable.transition?.idle) return;

      sortable.refreshShape();
    }
  );

  return {
    get sortable() {
      return sortable;
    },
    isDragging: () => trackedSortable().isDragging,
    isDropping: () => trackedSortable().isDropping,
    isDragSource: () => trackedSortable().isDragSource,
    isDropTarget: () => trackedSortable().isDropTarget,
    ref: setElement,
    handleRef: setHandle,
    sourceRef: setSource,
    targetRef: setTarget,
  };
}

function createPlaceholderId() {
  placeholderId += 1;

  return `__dnd-kit-solid-sortable-${placeholderId}`;
}

function withFeedbackPlugin<T extends Data>(
  plugins: SortableInput<T>['plugins'],
  feedback: FeedbackInput | undefined
): SortableInput<T>['plugins'] {
  if (feedback == null) return plugins;

  const feedbackPlugin = Feedback.configure({feedback});

  if (!plugins) {
    return (defaults) => [feedbackPlugin, ...defaults];
  }

  if (typeof plugins === 'function') {
    return (defaults) => [feedbackPlugin, ...plugins(defaults)];
  }

  return [feedbackPlugin, ...plugins];
}
