export * from '../../../node_modules/solid-js/dist/solid.js';

import {
  createEffect,
  createErrorBoundary,
} from '../../../node_modules/solid-js/dist/solid.js';

export function onMount(callback: () => void) {
  createEffect(
    () => undefined,
    () => callback()
  );
}

export function ErrorBoundary(props: {
  children?: unknown;
  fallback?: (error: unknown, reset: () => void) => unknown;
}) {
  const boundary = createErrorBoundary(
    () => props.children,
    (error, reset) => props.fallback?.(error(), reset)
  );

  return boundary();
}
