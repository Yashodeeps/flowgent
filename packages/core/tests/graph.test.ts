// Graph preset + orphan-detection middleware (Pattern 4 as graph middleware).

import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../src/store/index.js';
import {
  addEntity,
  childrenOf,
  emptyGraph,
  entityId,
  findOrphans,
  orphanMiddleware,
  removeEntity,
  type Entity,
  type GraphState,
  type OrphanInfo,
} from '../src/graph/index.js';

const ent = (id: string, kind = 'node'): Entity => ({ id: entityId(id), kind, data: {} });

describe('graph helpers', () => {
  it('addEntity adds the entity and a parent edge', () => {
    const store = createStore<GraphState>({ initial: emptyGraph() });
    store.mutate(addEntity(ent('root')));
    store.mutate(addEntity(ent('child'), entityId('root')));
    expect(Object.keys(store.getState().entities)).toEqual(['root', 'child']);
    expect(childrenOf(store.getState(), entityId('root'))).toEqual(['child']);
  });

  it('removeEntity removes the entity and its edges (no dangling)', () => {
    const store = createStore<GraphState>({ initial: emptyGraph() });
    store.mutate(addEntity(ent('root')));
    store.mutate(addEntity(ent('child'), entityId('root')));
    store.mutate(removeEntity(entityId('root')));
    expect(store.getState().entities.root).toBeUndefined();
    expect(store.getState().edges).toEqual([]); // edge cleaned
    expect(findOrphans(store.getState())).toEqual([]);
  });
});

describe('orphan middleware', () => {
  it('fires onOrphan when a parent entity is deleted but its edge remains', () => {
    const onOrphan = vi.fn<(o: OrphanInfo[], s: GraphState) => void>();
    const store = createStore<GraphState>({ initial: emptyGraph(), middleware: [orphanMiddleware({ onOrphan })] });
    store.mutate(addEntity(ent('root')));
    store.mutate(addEntity(ent('child'), entityId('root')));

    // Raw delete that does NOT clean edges → child is orphaned.
    store.mutate((d) => {
      delete d.entities.root;
    });

    expect(onOrphan).toHaveBeenCalledTimes(1);
    const [orphans] = onOrphan.mock.calls[0]!;
    expect(orphans).toEqual([{ orphanId: 'child', missingParentId: 'root' }]);
  });

  it('does not fire on non-removal mutations', () => {
    const onOrphan = vi.fn();
    const store = createStore<GraphState>({ initial: emptyGraph(), middleware: [orphanMiddleware({ onOrphan })] });
    store.mutate(addEntity(ent('root')));
    store.mutate((d) => {
      d.entities.root!.kind = 'changed';
    });
    expect(onOrphan).not.toHaveBeenCalled();
  });

  it('does not fire when a clean removeEntity leaves no dangling edge', () => {
    const onOrphan = vi.fn();
    const store = createStore<GraphState>({ initial: emptyGraph(), middleware: [orphanMiddleware({ onOrphan })] });
    store.mutate(addEntity(ent('root')));
    store.mutate(addEntity(ent('child'), entityId('root')));
    store.mutate(removeEntity(entityId('root')));
    expect(onOrphan).not.toHaveBeenCalled();
  });
});
