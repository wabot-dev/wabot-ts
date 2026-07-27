/**
 * What a repository declares about where its fields live. Set as a static on
 * the engine-specific repository bases (`PgJsonbRepository`,
 * `PgColumnsRepository`, …) and inherited through the constructor chain, so the
 * declaration is read off the repository class itself.
 *
 * It is a declaration of intent, not a binding: with no database connected the
 * memory backend serves every repository whatever it declares, which is what
 * keeps `DATABASE_URL`-less development working.
 *
 * A repository that extends plain `CrudRepository` / `ReadRepository` declares
 * nothing, and the active backend picks its own default strategy.
 */
export interface IStorageDeclaration {
  /** Backend the strategy belongs to; each engine module exports its own symbol. */
  engine: symbol
  /** Storage strategy within that engine, e.g. `'jsonb'` or `'columns'`. */
  strategy: string
}

/** The storage a repository (or extension) class declares, if any. */
export function storageOf(ctor: Function): IStorageDeclaration | undefined {
  const declared = (ctor as { storage?: IStorageDeclaration }).storage
  return declared && typeof declared === 'object' ? declared : undefined
}

/** Readable form for error messages: `pg/columns`. */
export function describeStorage(storage: IStorageDeclaration | undefined): string {
  if (!storage) return 'the backend default'
  return `${storage.engine.description ?? 'unknown'}/${storage.strategy}`
}
