import type {DragDropManager} from '@dnd-kit/dom';

type Renderer = DragDropManager['renderer'];

export function useRenderer(): {
  renderer: Renderer;
  trackRendering: (callback: () => void) => void;
} {
  let rendering: Promise<void> | null = null;
  let resolver: (() => void) | null = null;
  let scheduled = false;

  const resolveRendering = () => {
    scheduled = false;
    resolver?.();
    resolver = null;
    rendering = null;
  };

  return {
    renderer: {
      get rendering() {
        return rendering ?? Promise.resolve();
      },
    },
    trackRendering(callback: () => void) {
      if (!rendering) {
        rendering = new Promise<void>((resolve) => {
          resolver = resolve;
        });
      }

      callback();

      if (!scheduled) {
        scheduled = true;
        queueMicrotask(resolveRendering);
      }
    },
  };
}
