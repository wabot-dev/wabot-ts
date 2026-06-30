/**
 * Marker attached to components wrapped with {@link island}. The UI renderer
 * uses it to decide which components must hydrate on the client; the bundler
 * uses {@link IslandMeta.id} (assigned from the `*.island.tsx` file location) to
 * emit a per-island client bundle.
 */
export const ISLAND_MARKER = Symbol.for('wabot.ui.island')

export interface IslandMeta {
  /** The original component, rendered for SSR and hydrated on the client. */
  component: (props: any) => any
  /** Human-readable name (component name unless overridden). */
  name: string
  /** Stable bundle id, assigned during island discovery. Undefined until then. */
  id?: string
}

export interface IslandComponent<P = any> {
  (props: P): any
  [ISLAND_MARKER]: IslandMeta
}

/**
 * Mark a component as an interactive client "island". The component still
 * renders on the server, but only islands ship JavaScript and hydrate in the
 * browser. Islands must be the export of a `*.island.tsx` file so the bundler
 * can give them a stable id.
 *
 *   // Counter.island.tsx
 *   function Counter() { ... }
 *   export default island(Counter)
 */
export function island<P>(component: (props: P) => any, name?: string): IslandComponent<P> {
  const resolvedName = name ?? component.name ?? 'Island'
  const wrapped = ((props: P) => component(props)) as IslandComponent<P>
  wrapped[ISLAND_MARKER] = { component, name: resolvedName, id: undefined }
  // Help Preact/React devtools and our renderer show a meaningful name.
  ;(wrapped as any).displayName = resolvedName
  return wrapped
}

export function getIslandMeta(component: unknown): IslandMeta | undefined {
  return typeof component === 'function'
    ? (component as Partial<IslandComponent>)[ISLAND_MARKER]
    : undefined
}

export function isIsland(component: unknown): boolean {
  return getIslandMeta(component) != null
}

/** Assign the stable bundle id to an island, done during island discovery. */
export function setIslandId(component: unknown, id: string): void {
  const meta = getIslandMeta(component)
  if (meta) meta.id = id
}
