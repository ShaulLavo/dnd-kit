import {describe, expect, it} from 'bun:test';

import {DragDropManager, Droppable} from '@dnd-kit/dom';

describe('entity registration', () => {
  it('keeps an entity registered when its id is pending during registration', async () => {
    const manager = new DragDropManager();
    const droppable = new Droppable(
      {id: 'placeholder', register: false},
      manager
    );

    droppable.id = 'real';
    const cleanup = droppable.register();

    expect(manager.registry.droppables.get('real')).toBe(droppable);

    await Promise.resolve();
    await Promise.resolve();

    expect(manager.registry.droppables.get('real')).toBe(droppable);

    cleanup?.();
    manager.destroy();
  });

  it('unregisters the current id after a registered entity changes id', async () => {
    const manager = new DragDropManager();
    const droppable = new Droppable({id: 'first', register: false}, manager);
    const cleanup = droppable.register();

    droppable.id = 'second';

    await Promise.resolve();
    await Promise.resolve();

    expect(manager.registry.droppables.get('first')).toBeUndefined();
    expect(manager.registry.droppables.get('second')).toBe(droppable);

    cleanup?.();

    expect(manager.registry.droppables.get('second')).toBeUndefined();

    manager.destroy();
  });
});
