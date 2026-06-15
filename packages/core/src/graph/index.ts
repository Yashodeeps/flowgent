// @flowgent/core/graph — the entity-graph preset.
//
// A batteries-included state shape for structured, hierarchical data (the shape
// the Wizard uses, and a good default for plans/outlines/diagrams). The Store is
// generic; this is the opt-in graph layer + its orphan-detection middleware.

export type EntityId = string & { readonly __brand: 'EntityId' };
export const entityId = (s: string): EntityId => s as EntityId;

export interface Entity<D = unknown> {
  id: EntityId;
  kind: string;
  data: D;
}

export interface GraphState {
  entities: Record<string, Entity>;
  edges: Array<[EntityId, EntityId]>; // [parent, child]
}

export function emptyGraph(): GraphState {
  return { entities: {}, edges: [] };
}

// Recipe helpers — pass to store.mutate(addEntity(...)).
export function addEntity(entity: Entity, parent?: EntityId) {
  return (draft: GraphState): void => {
    draft.entities[entity.id] = entity;
    if (parent) draft.edges.push([parent, entity.id]);
  };
}

export function removeEntity(id: EntityId) {
  return (draft: GraphState): void => {
    delete draft.entities[id];
    draft.edges = draft.edges.filter(([p, c]) => p !== id && c !== id);
  };
}

export function childrenOf(state: GraphState, parent: EntityId): EntityId[] {
  return state.edges.filter(([p]) => p === parent).map(([, c]) => c);
}

export { orphanMiddleware, findOrphans } from './orphan.js';
export type { OrphanInfo, OrphanOptions } from './orphan.js';
