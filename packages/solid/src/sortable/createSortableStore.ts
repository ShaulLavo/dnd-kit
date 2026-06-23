import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  Type,
  UniqueIdentifier,
} from '@dnd-kit/abstract';
import type {DragDropManager, Draggable, Droppable} from '@dnd-kit/dom';
import {isSortable} from '@dnd-kit/dom/sortable';
import {arrayMove, move} from '@dnd-kit/helpers';

export type SortableStoreItem =
  | UniqueIdentifier
  | {id: UniqueIdentifier}
  | null;

export type SortableStoreItems<
  T extends SortableStoreItem = SortableStoreItem,
> = Record<string, T[]>;

export interface SortableStoreChange<
  TItem extends UniqueIdentifier = UniqueIdentifier,
  TGroup extends UniqueIdentifier = UniqueIdentifier,
> {
  itemId: TItem;
  fromGroup: TGroup;
  toGroup: TGroup;
  fromIndex: number;
  toIndex: number;
  prevId: TItem | undefined;
  nextId: TItem | undefined;
}

export interface SortableStoreGroupChange<
  TGroup extends UniqueIdentifier = UniqueIdentifier,
> {
  groupId: TGroup;
  fromIndex: number;
  toIndex: number;
  prevId: TGroup | undefined;
  nextId: TGroup | undefined;
}

export interface SortableStoreMoveContext<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
> {
  event: SortableStoreDragOverEvent;
  previousItems: TItems;
  nextItems: TItems;
  change: SortableStoreChange<TItem, TGroup> | undefined;
}

export interface SortableStoreGroupMoveContext<
  TGroup extends UniqueIdentifier,
> {
  event: SortableStoreDragOverEvent;
  previousGroups: TGroup[];
  nextGroups: TGroup[];
  change: SortableStoreGroupChange<TGroup> | undefined;
}

export interface SortableStoreCommitContext<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
> {
  event: SortableStoreDragEndEvent;
  initialItems: TItems;
  currentItems: TItems;
  change: SortableStoreChange<TItem, TGroup>;
}

export interface SortableStoreGroupCommitContext<
  TGroup extends UniqueIdentifier,
> {
  event: SortableStoreDragEndEvent;
  initialGroups: TGroup[];
  currentGroups: TGroup[];
  change: SortableStoreGroupChange<TGroup>;
}

export type SortableStoreSetItems<TItems extends SortableStoreItems> = (
  updater: (items: TItems) => void
) => void;

export type SortableStoreSetGroups<TGroup extends UniqueIdentifier> = (
  updater: (groups: TGroup[]) => void
) => void;

export type SortableStoreAction = <Args extends any[], Y, R>(
  fn: (...args: Args) => Generator<Y, R, any> | AsyncGenerator<Y, R, any>
) => (...args: Args) => Promise<R>;

export type SortableStoreDragStartEvent = DragStartEvent<
  Draggable,
  Droppable,
  DragDropManager
>;

export type SortableStoreDragOverEvent = DragOverEvent<
  Draggable,
  Droppable,
  DragDropManager
>;

export type SortableStoreDragEndEvent = DragEndEvent<
  Draggable,
  Droppable,
  DragDropManager
>;

export interface CreateSortableStoreInput<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier = UniqueIdentifier,
  TGroup extends UniqueIdentifier = UniqueIdentifier,
> {
  items: () => TItems;
  setItems?: SortableStoreSetItems<TItems>;
  groups?: () => readonly TGroup[];
  setGroups?: SortableStoreSetGroups<TGroup>;
  type?: Type;
  groupType?: Type;
  action?: SortableStoreAction;
  flush?: () => void;
  getItemId?: (item: TItems[string][number]) => TItem | undefined;
  applyMove?: (
    context: SortableStoreMoveContext<TItems, TItem, TGroup>
  ) => void;
  onCommit?: (
    change: SortableStoreChange<TItem, TGroup>,
    context: SortableStoreCommitContext<TItems, TItem, TGroup>
  ) => void | Promise<void>;
  applyGroupMove?: (context: SortableStoreGroupMoveContext<TGroup>) => void;
  onGroupCommit?: (
    change: SortableStoreGroupChange<TGroup>,
    context: SortableStoreGroupCommitContext<TGroup>
  ) => void | Promise<void>;
  onError?: (error: unknown) => void;
}

export interface SortableStoreControls<
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
> {
  onDragStart(event: SortableStoreDragStartEvent): void;
  onDragOver(event: SortableStoreDragOverEvent): void;
  onDragEnd(event: SortableStoreDragEndEvent): void;
  cancel(reason?: unknown): void;
  get change(): SortableStoreChange<TItem, TGroup> | undefined;
  get groupChange(): SortableStoreGroupChange<TGroup> | undefined;
}

type QueueEntry<
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
> =
  | {
      type: 'move';
      event: SortableStoreDragOverEvent;
    }
  | {
      type: 'commit';
      event: SortableStoreDragEndEvent;
      resolve(change: SortableStoreChange<TItem, TGroup> | undefined): void;
      reject(error: unknown): void;
    }
  | {
      type: 'cancel';
      reason: unknown;
    };

interface Queue<T> {
  push(entry: T): void;
  next(): Promise<T>;
}

const defaultSortableType = 'item';
const defaultSortableGroupType = 'column';
const canceled = Symbol('sortable-store-canceled');
type SortableStoreEventKind = 'items' | 'groups';

export function createSortableStore<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier = UniqueIdentifier,
  TGroup extends UniqueIdentifier = UniqueIdentifier,
>(
  input: CreateSortableStoreInput<TItems, TItem, TGroup>
): SortableStoreControls<TItem, TGroup> {
  let queue: Queue<QueueEntry<TItem, TGroup>> | undefined;
  let transaction: Promise<unknown> | undefined;
  let initialItems: TItems | undefined;
  let initialGroups: TGroup[] | undefined;
  let currentItems: TItems | undefined;
  let currentGroups: TGroup[] | undefined;
  let currentChange: SortableStoreChange<TItem, TGroup> | undefined;
  let currentGroupChange: SortableStoreGroupChange<TGroup> | undefined;
  let currentKind: SortableStoreEventKind | undefined;

  const applyMoveEntry = (
    entry: Extract<QueueEntry<TItem, TGroup>, {type: 'move'}>
  ) => {
    const kind = getEventKind(input, entry.event);

    if (!kind) return;

    if (kind === 'groups') {
      applyQueuedGroupMove(
        input,
        entry,
        initialGroups!,
        currentGroups!,
        (next) => {
          currentKind = 'groups';
          currentGroups = next.groups;
          currentGroupChange = next.change;
        }
      );
      return;
    }

    applyQueuedMove(input, entry, initialItems!, currentItems!, (next) => {
      currentKind = 'items';
      currentItems = next.items;
      currentChange = next.change;
    });
  };

  function* commitEntry(
    entry: Extract<QueueEntry<TItem, TGroup>, {type: 'commit'}>
  ) {
    if (currentKind === 'groups') {
      return yield* commitQueuedGroupMove(
        input,
        entry,
        initialGroups!,
        currentGroups!,
        currentGroupChange
      );
    }

    return yield* commitQueuedMove(
      input,
      entry,
      initialItems!,
      currentItems!,
      currentChange
    );
  }

  const begin = () => {
    if (queue) return;

    queue = createQueue();
    initialItems = snapshotItems(input);
    initialGroups = snapshotGroups(input);
    currentItems = initialItems;
    currentGroups = initialGroups;
    transaction = runAction(input.action, function* () {
      while (queue) {
        const entry = yield queue.next();

        if (entry.type === 'move') {
          applyMoveEntry(entry);
          continue;
        }

        if (entry.type === 'commit') {
          const committed = yield* commitEntry(entry);
          cleanup();
          return committed;
        }

        cleanup();
        throw entry.reason ?? canceled;
      }
    }).catch((error) => {
      cleanup();

      if (error !== canceled) {
        input.onError?.(error);
      }
    });
  };

  const enqueue = (entry: QueueEntry<TItem, TGroup>) => {
    begin();
    queue!.push(entry);
    queueMicrotask(() => input.flush?.());
  };

  const cleanup = () => {
    queue = undefined;
    transaction = undefined;
    initialItems = undefined;
    initialGroups = undefined;
    currentItems = undefined;
    currentGroups = undefined;
    currentChange = undefined;
    currentGroupChange = undefined;
    currentKind = undefined;
  };

  return {
    onDragStart(event) {
      if (getEventKind(input, event)) {
        begin();
      }
    },
    onDragOver(event) {
      if (!getEventKind(input, event)) return;

      event.preventDefault();
      enqueue({type: 'move', event});
    },
    onDragEnd(event) {
      if (!queue) return;

      if (event.canceled) {
        queue.push({type: 'cancel', reason: canceled});
        return;
      }

      const pendingCommit = new Promise<
        SortableStoreChange<TItem, TGroup> | undefined
      >((resolve, reject) => {
        queue!.push({type: 'commit', event, resolve, reject});
      });

      const suspension =
        currentChange || currentGroupChange ? event.suspend() : undefined;
      pendingCommit.then(
        () => suspension?.resume(),
        () => suspension?.abort()
      );
    },
    cancel(reason = canceled) {
      queue?.push({type: 'cancel', reason});
      transaction?.catch(() => {});
    },
    get change() {
      return currentChange;
    },
    get groupChange() {
      return currentGroupChange;
    },
  };
}

function* commitQueuedMove<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(
  input: CreateSortableStoreInput<TItems, TItem, TGroup>,
  entry: Extract<QueueEntry<TItem, TGroup>, {type: 'commit'}>,
  initialItems: TItems,
  currentItems: TItems,
  change: SortableStoreChange<TItem, TGroup> | undefined
) {
  try {
    if (change && input.onCommit) {
      yield input.onCommit(change, {
        event: entry.event,
        initialItems,
        currentItems,
        change,
      });
    }

    entry.resolve(change);
    return change;
  } catch (error) {
    entry.reject(error);
    throw error;
  }
}

function* commitQueuedGroupMove<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(
  input: CreateSortableStoreInput<TItems, TItem, TGroup>,
  entry: Extract<QueueEntry<TItem, TGroup>, {type: 'commit'}>,
  initialGroups: TGroup[],
  currentGroups: TGroup[],
  change: SortableStoreGroupChange<TGroup> | undefined
) {
  try {
    if (change && input.onGroupCommit) {
      yield input.onGroupCommit(change, {
        event: entry.event,
        initialGroups,
        currentGroups,
        change,
      });
    }

    entry.resolve(undefined);
    return change;
  } catch (error) {
    entry.reject(error);
    throw error;
  }
}

function applyQueuedMove<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(
  input: CreateSortableStoreInput<TItems, TItem, TGroup>,
  entry: Extract<QueueEntry<TItem, TGroup>, {type: 'move'}>,
  initialItems: TItems,
  currentItems: TItems,
  onMove: (next: {
    items: TItems;
    change: SortableStoreChange<TItem, TGroup> | undefined;
  }) => void
) {
  const nextItems = move(currentItems as any, entry.event) as TItems;

  if (nextItems === currentItems) return;

  const change = getChange(input, initialItems, nextItems, entry.event);
  const context = {
    event: entry.event,
    previousItems: currentItems,
    nextItems,
    change,
  };

  if (input.applyMove) {
    input.applyMove(context);
  } else {
    applyDefaultMove(input, nextItems);
  }

  input.flush?.();
  onMove({items: nextItems, change});
}

function applyQueuedGroupMove<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(
  input: CreateSortableStoreInput<TItems, TItem, TGroup>,
  entry: Extract<QueueEntry<TItem, TGroup>, {type: 'move'}>,
  initialGroups: TGroup[],
  currentGroups: TGroup[],
  onMove: (next: {
    groups: TGroup[];
    change: SortableStoreGroupChange<TGroup> | undefined;
  }) => void
) {
  const nextGroups = moveGroups(currentGroups, entry.event);

  if (nextGroups === currentGroups) return;

  const change = getGroupChange(initialGroups, nextGroups, entry.event);
  const context = {
    event: entry.event,
    previousGroups: currentGroups,
    nextGroups,
    change,
  };

  if (input.applyGroupMove) {
    input.applyGroupMove(context);
  } else {
    applyDefaultGroupMove(input, nextGroups);
  }

  input.flush?.();
  onMove({groups: nextGroups, change});
}

function moveGroups<TGroup extends UniqueIdentifier>(
  currentGroups: TGroup[],
  event: SortableStoreDragOverEvent
) {
  const {source, target, canceled} = event.operation;

  if (!source || !target || canceled) return currentGroups;

  const sourceIndex = currentGroups.indexOf(source.id as TGroup);
  const targetIndex = currentGroups.indexOf(target.id as TGroup);

  if (sourceIndex < 0 || targetIndex < 0) return currentGroups;

  return arrayMove(currentGroups, sourceIndex, targetIndex);
}

function applyDefaultMove<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(input: CreateSortableStoreInput<TItems, TItem, TGroup>, nextItems: TItems) {
  const setItems = input.setItems;

  if (!setItems) {
    throw new Error(
      'createSortableStore requires setItems or applyMove to apply a move'
    );
  }

  setItems((items) => {
    const writable = items as SortableStoreItems;

    for (const group of getGroups(input, nextItems)) {
      writable[String(group)] = [...getGroupItems(nextItems, group)];
    }
  });
}

function applyDefaultGroupMove<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(
  input: CreateSortableStoreInput<TItems, TItem, TGroup>,
  nextGroups: TGroup[]
) {
  const setGroups = input.setGroups;

  if (!setGroups) {
    throw new Error(
      'createSortableStore requires setGroups or applyGroupMove to apply a group move'
    );
  }

  setGroups((groups) => {
    groups.splice(0, groups.length, ...nextGroups);
  });
}

function getEventKind<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(
  input: CreateSortableStoreInput<TItems, TItem, TGroup>,
  event: SortableStoreDragStartEvent | SortableStoreDragOverEvent
): SortableStoreEventKind | undefined {
  const {source, target} = event.operation;

  if (!isSortable(source)) return;
  if (!isSortable(target) && 'preventDefault' in event) return;

  if (source.sortable.type === (input.type ?? defaultSortableType)) {
    return 'items';
  }

  if (source.sortable.type !== (input.groupType ?? defaultSortableGroupType)) {
    return;
  }

  if (!input.setGroups && !input.applyGroupMove && !input.onGroupCommit) {
    return;
  }

  if (
    'preventDefault' in event &&
    isSortable(target) &&
    target.sortable.type !== source.sortable.type
  ) {
    return;
  }

  return 'groups';
}

function getChange<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(
  input: CreateSortableStoreInput<TItems, TItem, TGroup>,
  initialItems: TItems,
  nextItems: TItems,
  event: SortableStoreDragOverEvent
) {
  const itemId = event.operation.source?.id as TItem | undefined;

  if (itemId == null) return;

  const from = findItem(input, initialItems, itemId);
  const to = findItem(input, nextItems, itemId);

  if (!from || !to) return;

  const neighbors = getNeighbors(input, nextItems, to.group, to.index, itemId);

  return {
    itemId,
    fromGroup: from.group,
    toGroup: to.group,
    fromIndex: from.index,
    toIndex: to.index,
    prevId: neighbors.prevId,
    nextId: neighbors.nextId,
  };
}

function getGroupChange<TGroup extends UniqueIdentifier>(
  initialGroups: TGroup[],
  nextGroups: TGroup[],
  event: SortableStoreDragOverEvent
) {
  const groupId = event.operation.source?.id as TGroup | undefined;

  if (groupId == null) return;

  const fromIndex = initialGroups.indexOf(groupId);
  const toIndex = nextGroups.indexOf(groupId);

  if (fromIndex < 0 || toIndex < 0) return;

  return {
    groupId,
    fromIndex,
    toIndex,
    prevId: nextGroups[toIndex - 1],
    nextId: nextGroups[toIndex + 1],
  };
}

function findItem<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(
  input: CreateSortableStoreInput<TItems, TItem, TGroup>,
  items: TItems,
  itemId: TItem
) {
  for (const group of getGroups(input, items)) {
    const index = getGroupItems(items, group).findIndex((item) => {
      return getItemId(input, item) === itemId;
    });

    if (index != null && index >= 0) {
      return {group: group as TGroup, index};
    }
  }
}

function getNeighbors<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(
  input: CreateSortableStoreInput<TItems, TItem, TGroup>,
  items: TItems,
  group: TGroup,
  index: number,
  itemId: TItem
) {
  const groupItems = getGroupItems(items, group);
  const previous = groupItems[index - 1];
  const next = groupItems[index + 1];
  const prevId = getItemId(input, previous) as TItem | undefined;
  const nextId = getItemId(input, next) as TItem | undefined;

  return {
    prevId: prevId === itemId ? undefined : prevId,
    nextId: nextId === itemId ? undefined : nextId,
  };
}

function getItemId<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(
  input: CreateSortableStoreInput<TItems, TItem, TGroup>,
  item: TItems[string][number] | undefined
) {
  if (item == null) return undefined;
  if (input.getItemId) return input.getItemId(item);
  if (typeof item === 'object') return item.id;

  return item;
}

function snapshotItems<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(input: CreateSortableStoreInput<TItems, TItem, TGroup>) {
  const items = input.items();
  const snapshot: SortableStoreItems = {};

  for (const group of getGroups(input, items)) {
    snapshot[String(group)] = [...getGroupItems(items, group)];
  }

  return snapshot as TItems;
}

function snapshotGroups<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(input: CreateSortableStoreInput<TItems, TItem, TGroup>) {
  return [...(input.groups?.() ?? [])] as TGroup[];
}

function getGroups<
  TItems extends SortableStoreItems,
  TItem extends UniqueIdentifier,
  TGroup extends UniqueIdentifier,
>(input: CreateSortableStoreInput<TItems, TItem, TGroup>, items: TItems) {
  const groups = new Map<string, UniqueIdentifier>();

  for (const group of Object.keys(items)) {
    groups.set(String(group), group);
  }

  for (const group of input.groups?.() ?? []) {
    groups.set(String(group), group);
  }

  return Array.from(groups.values());
}

function getGroupItems<TItems extends SortableStoreItems>(
  items: TItems,
  group: UniqueIdentifier
) {
  return items[String(group)] ?? [];
}

function createQueue<T>(): Queue<T> {
  const entries: T[] = [];
  let pending: ((entry: T) => void) | undefined;

  return {
    push(entry) {
      if (!pending) {
        entries.push(entry);
        return;
      }

      const resolve = pending;
      pending = undefined;
      resolve(entry);
    },
    next() {
      const entry = entries.shift();

      if (entry) return Promise.resolve(entry);

      return new Promise((resolve) => {
        pending = resolve;
      });
    },
  };
}

function runAction<Y, R>(
  action: SortableStoreAction | undefined,
  fn: () => Generator<Y, R, any> | AsyncGenerator<Y, R, any>
) {
  const run = action ?? runGenerator;

  return run(fn)();
}

function runGenerator<Args extends any[], Y, R>(
  fn: (...args: Args) => Generator<Y, R, any> | AsyncGenerator<Y, R, any>
) {
  return async (...args: Args) => {
    const iterator = fn(...args);
    let result = await iterator.next();

    while (!result.done) {
      result = await iterator.next(await result.value);
    }

    return result.value;
  };
}
