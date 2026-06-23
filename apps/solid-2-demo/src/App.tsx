import {
  action,
  createOptimisticStore,
  createSignal,
  flush,
  For,
  refresh,
} from 'solid-js';
import {CollisionPriority} from '@dnd-kit/abstract';
import {defaultPreset, KeyboardSensor, PointerSensor} from '@dnd-kit/dom';
import {DragDropProvider} from '@dnd-kit/solid';
import {
  createSortableStore,
  type SortableStoreChange,
  type SortableStoreGroupChange,
  useSortable,
} from '@dnd-kit/solid/sortable';

type ColumnId = 'Backlog' | 'Design' | 'Build' | 'Ship';
type ItemId = string;

interface Column {
  id: ColumnId;
}

interface Card {
  id: ItemId;
}

interface Board {
  columns: Column[];
  items: Record<ColumnId, Card[]>;
  counter: number;
}

const colors: Record<ColumnId, string> = {
  Backlog: '#2563eb',
  Design: '#db2777',
  Build: '#059669',
  Ship: '#7c3aed',
};

const sensors = [
  PointerSensor.configure({
    activatorElements(source) {
      return [source.element, source.handle];
    },
  }),
  KeyboardSensor,
];

const initialBoard: Board = {
  columns: (['Backlog', 'Design', 'Build', 'Ship'] as const).map(createColumn),
  items: {
    Backlog: ['Copy checklist', 'Billing states', 'Keyboard QA'].map(createCard),
    Design: ['Board density', 'Card tokens'].map(createCard),
    Build: ['Optimistic moves', 'Fractional order'].map(createCard),
    Ship: [],
  },
  counter: 1,
};

let authoritativeBoard = cloneBoard(initialBoard);
let nextCardCounter = initialBoard.counter;

function SortableItem(props: {card: Card; column: ColumnId; index: number}) {
  const {isDragging, ref, handleRef} = useSortable({
    get id() {
      return props.card.id;
    },
    get index() {
      return props.index;
    },
    get group() {
      return props.column;
    },
    get data() {
      return {group: props.column};
    },
    accept: 'item',
    feedback: 'clone',
    type: 'item',
  });

  return (
    <li
      ref={ref}
      class="card"
      data-dragging={isDragging() ? 'true' : undefined}
      style={{'--accent': colors[props.column]}}
    >
      <span>{props.card.id}</span>
      <button
        ref={handleRef}
        class="handle"
        aria-label={`Drag ${props.card.id}`}
      />
    </li>
  );
}

function SortableColumn(props: {
  id: ColumnId;
  index: number;
  rows: Card[];
  onAdd(column: ColumnId): void;
}) {
  const {isDragging, ref, handleRef} = useSortable({
    get id() {
      return props.id;
    },
    get index() {
      return props.index;
    },
    accept: ['column', 'item'],
    collisionPriority: CollisionPriority.Low,
    type: 'column',
  });

  return (
    <section
      ref={ref}
      class="column"
      data-dragging={isDragging() ? 'true' : undefined}
      style={{'--accent': colors[props.id]}}
    >
      <header>
        <button
          ref={handleRef}
          class="handle column-handle"
          aria-label={`Drag ${props.id}`}
        />
        <h2>{props.id}</h2>
        <button class="add" onClick={() => props.onAdd(props.id)}>
          Add
        </button>
      </header>
      <ul>
        <For each={props.rows}>
          {(card, itemIndex) => (
            <SortableItem
              card={card}
              column={props.id}
              index={itemIndex()}
            />
          )}
        </For>
      </ul>
    </section>
  );
}

export default function App() {
  const [board, setBoard] = createOptimisticStore(
    async () => cloneBoard(authoritativeBoard),
    cloneBoard(authoritativeBoard)
  );
  const [lastCommit, setLastCommit] = createSignal<string>();

  const sortableStore = createSortableStore<
    Board['items'],
    ItemId,
    ColumnId
  >({
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
      await persistMove(change);
    },
    async onGroupCommit(change) {
      await persistColumnMove(change);
    },
    onError(error) {
      console.error(error);
    },
  });

  const addItemAction = action(function* (column: ColumnId) {
    const counter = nextCardCounter++;
    const item = createCard(`${column} ${counter}`);

    setBoard((draft) => {
      draft.counter = Math.max(draft.counter, nextCardCounter);
      draft.items[column] = [...draft.items[column], item];
    });

    yield delay(80);
    authoritativeBoard = addItemToBoard(authoritativeBoard, column, item);
    yield refreshBoard();
  });

  const addItem = (column: ColumnId) => {
    addItemAction(column).catch((error) => console.error(error));
  };

  return (
    <DragDropProvider
      plugins={defaultPreset.plugins}
      sensors={sensors}
      onDragStart={sortableStore.onDragStart}
      onDragOver={sortableStore.onDragOver}
      onDragEnd={sortableStore.onDragEnd}
    >
      <main>
        <div class="toolbar">
          <div>
            <h1>Strello</h1>
            <p>Solid 2 optimistic store</p>
          </div>
          <output>{lastCommit() ?? 'No commits yet'}</output>
        </div>
        <div class="board">
          <For each={board.columns}>
            {(column, columnIndex) => (
              <SortableColumn
                id={column.id}
                index={columnIndex()}
                rows={board.items[column.id]}
                onAdd={addItem}
              />
            )}
          </For>
        </div>
      </main>
    </DragDropProvider>
  );

  async function persistMove(change: SortableStoreChange<ItemId, ColumnId>) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    authoritativeBoard = {
      ...cloneBoard(authoritativeBoard),
      items: applyItemChange(authoritativeBoard.items, change),
    };
    setLastCommit(formatChange(change));
    console.info('dnd-kit solid store commit', change);
    await refreshBoard();
  }

  async function persistColumnMove(
    change: SortableStoreGroupChange<ColumnId>
  ) {
    await delay(80);
    authoritativeBoard = {
      ...cloneBoard(authoritativeBoard),
      columns: applyColumnChange(authoritativeBoard.columns, change),
    };
    setLastCommit(formatGroupChange(change));
    console.info('dnd-kit solid group commit', change);
    await refreshBoard();
  }

  async function refreshBoard() {
    refresh(board);
    await Promise.resolve();
    flush();
  }
}

function delay(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function cloneBoard(board: Board): Board {
  return {
    columns: board.columns.map(cloneColumn),
    counter: board.counter,
    items: cloneItems(board.items),
  };
}

function cloneItems(items: Board['items']) {
  return Object.fromEntries(
    Object.entries(items).map(([column, rows]) => [
      column,
      rows.map(cloneCard),
    ])
  ) as Board['items'];
}

function createColumn(id: ColumnId): Column {
  return {id};
}

function cloneColumn(column: Column): Column {
  return createColumn(column.id);
}

function createCard(id: ItemId): Card {
  return {id};
}

function cloneCard(card: Card): Card {
  return createCard(card.id);
}

function addItemToBoard(board: Board, column: ColumnId, item: Card): Board {
  const next = cloneBoard(board);

  if (!next.items[column].some((card) => card.id === item.id)) {
    next.items[column] = [...next.items[column], cloneCard(item)];
  }

  next.counter = Math.max(next.counter, nextCardCounter);

  return next;
}

function applyItemChange(
  items: Board['items'],
  change: SortableStoreChange<ItemId, ColumnId>
) {
  const next = cloneItems(items);
  const currentGroup = findItemGroup(next, change.itemId);

  if (!currentGroup) return next;

  const card = next[currentGroup].find((card) => card.id === change.itemId);

  if (!card) return next;

  next[currentGroup] = removeById(next[currentGroup], change.itemId);
  next[change.toGroup] = insertRelative(
    removeById(next[change.toGroup], change.itemId),
    card,
    change.prevId,
    change.nextId,
    change.toIndex
  );

  return next;
}

function applyColumnChange(
  columns: Column[],
  change: SortableStoreGroupChange<ColumnId>
) {
  const column = columns.find((column) => column.id === change.groupId);

  if (!column) return columns.map(cloneColumn);

  return insertRelative(
    removeById(columns, change.groupId),
    column,
    change.prevId,
    change.nextId,
    change.toIndex
  );
}

function findItemGroup(items: Board['items'], itemId: ItemId) {
  return (Object.keys(items) as ColumnId[]).find((column) => {
    return items[column].some((card) => card.id === itemId);
  });
}

function orderColumns(columns: Column[], nextIds: readonly ColumnId[]) {
  const byId = new Map(columns.map((column) => [column.id, column]));

  return nextIds.flatMap((id) => {
    const column = byId.get(id);

    return column ? [column] : [];
  });
}

function removeById<T extends {id: string}>(rows: T[], id: string) {
  return rows.filter((row) => row.id !== id);
}

function insertRelative<T extends {id: string}>(
  rows: T[],
  item: T,
  prevId: string | undefined,
  nextId: string | undefined,
  fallbackIndex: number
) {
  const prevIndex = findIndexById(rows, prevId);

  if (prevIndex >= 0) {
    return insertAt(rows, item, prevIndex + 1);
  }

  const nextIndex = findIndexById(rows, nextId);

  if (nextIndex >= 0) {
    return insertAt(rows, item, nextIndex);
  }

  return insertAt(rows, item, fallbackIndex);
}

function findIndexById<T extends {id: string}>(
  rows: T[],
  id: string | undefined
) {
  if (id == null) return -1;

  return rows.findIndex((row) => row.id === id);
}

function insertAt<T>(rows: T[], item: T, index: number) {
  const next = [...rows];
  const safeIndex = Math.max(0, Math.min(index, next.length));

  next.splice(safeIndex, 0, item);

  return next;
}

function formatChange(change: SortableStoreChange<ItemId, ColumnId>) {
  const prev = change.prevId ?? 'start';
  const next = change.nextId ?? 'end';

  return `${change.itemId}: ${change.fromGroup}[${change.fromIndex}] -> ${change.toGroup}[${change.toIndex}], between ${prev} and ${next}`;
}

function formatGroupChange(change: SortableStoreGroupChange<ColumnId>) {
  const prev = change.prevId ?? 'start';
  const next = change.nextId ?? 'end';

  return `${change.groupId}: column ${change.fromIndex} -> ${change.toIndex}, between ${prev} and ${next}`;
}
