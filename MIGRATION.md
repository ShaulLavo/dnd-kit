# Solid 2 Optimistic Store Migration

This fork updates `@dnd-kit/solid` from the upstream `0.5.0` Solid 1 adapter to a Solid 2 beta adapter and adds a store-controlled sortable primitive for optimistic Kanban-style boards.

## Runtime Requirements

- `solid-js@2.0.0-beta.14`
- `@solidjs/web@2.0.0-beta.14`
- Vite 7 or another build pipeline that can compile Solid JSX with `moduleName: "@solidjs/web"`
- TypeScript with `jsxImportSource: "@solidjs/web"`

`@dnd-kit/solid` now imports JSX/runtime helpers from `@solidjs/web`. Render app roots from `@solidjs/web`, not `solid-js/web`:

```tsx
import {render} from '@solidjs/web';

import App from './App';

render(() => <App />, document.getElementById('root')!);
```

## Install From This Fork

For local development, link the changed packages from the workspace:

```sh
bun install
bun --filter @dnd-kit/solid build
bun link packages/abstract packages/dom packages/helpers packages/state packages/solid
```

In the consuming Solid 2 app:

```sh
bun link @dnd-kit/abstract @dnd-kit/dom @dnd-kit/helpers @dnd-kit/state @dnd-kit/solid
bun add solid-js@2.0.0-beta.14 @solidjs/web@2.0.0-beta.14
```

For a tarball install instead:

```sh
bun --filter @dnd-kit/solid build
npm pack packages/solid
```

Pack and install the other changed workspace packages if the app is not linked against this monorepo.

## Vite Notes

The adapter package itself is compiled against Solid 2. Current Solid Vite and Storybook tooling may still emit old helper imports, so this fork's demo and Storybook use a small runtime bridge plus explicit aliases while the Solid 2 compiler ecosystem settles:

```ts
solid({
  dev: false,
  hot: false,
  solid: {
    moduleName: '/absolute/path/to/solid-web-runtime.ts',
  },
});
```

The bridge re-exports `@solidjs/web` and maps compiler helper names like `effect` and `use` to Solid 2 primitives. It does not pull in Solid 1. The demo also aliases `solid-js/web` to that bridge for dependencies that have not moved to `@solidjs/web` yet.

## Store-Controlled Sortables

Import `createSortableStore` from `@dnd-kit/solid/sortable` and wire it into `DragDropProvider`. The primitive reads order from your store and writes drag-over changes back into it inside the provided `action` transition.

```tsx
import {action, createOptimisticStore, flush} from 'solid-js';
import {DragDropProvider} from '@dnd-kit/solid';
import {createSortableStore} from '@dnd-kit/solid/sortable';

const [board, setBoard] = createOptimisticStore(initialBoard);

const sortableStore = createSortableStore({
  action,
  flush,
  groups: () => board.columns.map((column) => column.id),
  items: () => board.items,
  setItems(update) {
    setBoard((draft) => {
      update(draft.items);
    });
  },
  applyGroupMove({nextGroups}) {
    setBoard((draft) => {
      draft.columns = orderColumns(draft.columns, nextGroups);
    });
  },
  async onCommit(change) {
    await persistItemOrder(change);
    await refetchBoard();
  },
  async onGroupCommit(change) {
    await persistColumnOrder(change);
    await refetchBoard();
  },
});

<DragDropProvider
  onDragStart={sortableStore.onDragStart}
  onDragOver={sortableStore.onDragOver}
  onDragEnd={sortableStore.onDragEnd}
>
  {/* columns and cards */}
</DragDropProvider>;
```

`SortableStoreChange` is shaped for fractional-order persistence:

```ts
interface SortableStoreChange {
  itemId: UniqueIdentifier;
  fromGroup: string;
  toGroup: string;
  fromIndex: number;
  toIndex: number;
  prevId: UniqueIdentifier | undefined;
  nextId: UniqueIdentifier | undefined;
}
```

Column reorders use `SortableStoreGroupChange` with `groupId`, `fromIndex`, `toIndex`, `prevId`, and `nextId`.

## Demo

`apps/solid-2-demo` is the Solid 2 proving ground. It shows:

- one optimistic store for columns, cards, and add-card state
- nested column and item sortables
- drag handles and clone feedback
- item and column commit events
- an empty `Ship` column for empty-list reconcile coverage

Run it with:

```sh
bun --filter @dnd-kit/solid-2-demo dev
```

## Caveats

- The demo uses derived `createOptimisticStore(async () => cloneBoard(authoritativeBoard), cloneBoard(authoritativeBoard))`. Keep the source cloned; returning live authoritative objects can leak optimistic writes into server truth and can make `refresh()` no-op on identity.
- The Vite and Storybook shims are build-tool compatibility glue for current Solid 2 beta tooling, not a Solid 1 runtime dependency.
- The docs and examples are updated for Solid 2, but external sandboxes may need the same compiler `moduleName: "@solidjs/web"` setting.
