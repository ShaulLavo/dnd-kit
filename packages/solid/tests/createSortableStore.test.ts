import {describe, expect, it} from 'bun:test';

import {Sortable} from '@dnd-kit/dom/sortable';

import {createSortableStore} from '../src/sortable/createSortableStore.ts';

function createColumn(id: string, index: number) {
  return new Sortable(
    {id, index, plugins: [], transition: null, type: 'column'},
    undefined
  );
}

function dragStart(source: Sortable['draggable']) {
  return {
    operation: {
      canceled: false,
      source,
      target: null,
    },
  } as any;
}

function dragOver(
  source: Sortable['draggable'],
  target: Sortable['droppable']
) {
  return {
    defaultPrevented: false,
    operation: {
      canceled: false,
      source,
      target,
    },
    preventDefault() {
      this.defaultPrevented = true;
    },
  } as any;
}

function settleQueue() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createSortableStore group moves', () => {
  it('allows a group to move past the next neighbor', async () => {
    let groups = ['Backlog', 'Design', 'Build', 'Ship'];
    const columns = Object.fromEntries(
      groups.map((id, index) => [id, createColumn(id, index)])
    ) as Record<string, Sortable>;
    const syncIndices = () => {
      for (const [index, id] of groups.entries()) {
        columns[id]!.index = index;
      }
    };
    const store = createSortableStore({
      applyGroupMove({nextGroups}) {
        groups = [...nextGroups];
        syncIndices();
      },
      groups: () => groups,
      items: () => ({}),
    });

    store.onDragStart(dragStart(columns.Backlog!.draggable));
    store.onDragOver(
      dragOver(columns.Backlog!.draggable, columns.Design!.droppable)
    );
    await settleQueue();

    expect(groups).toEqual(['Design', 'Backlog', 'Build', 'Ship']);

    store.onDragOver(
      dragOver(columns.Backlog!.draggable, columns.Build!.droppable)
    );
    await settleQueue();

    expect(groups).toEqual(['Design', 'Build', 'Backlog', 'Ship']);

    store.cancel();
  });

  it('does not reconcile group moves from a stale source index', async () => {
    let groups = ['Backlog', 'Design', 'Build', 'Ship'];
    const columns = Object.fromEntries(
      groups.map((id, index) => [id, createColumn(id, index)])
    ) as Record<string, Sortable>;
    const store = createSortableStore({
      applyGroupMove({nextGroups}) {
        groups = [...nextGroups];
      },
      groups: () => groups,
      items: () => ({}),
    });

    store.onDragStart(dragStart(columns.Backlog!.draggable));
    store.onDragOver(
      dragOver(columns.Backlog!.draggable, columns.Design!.droppable)
    );
    await settleQueue();

    expect(groups).toEqual(['Design', 'Backlog', 'Build', 'Ship']);
    expect(columns.Backlog!.index).toBe(0);

    store.onDragOver(
      dragOver(columns.Backlog!.draggable, columns.Build!.droppable)
    );
    await settleQueue();

    expect(groups).toEqual(['Design', 'Build', 'Backlog', 'Ship']);

    store.cancel();
  });
});
