// The Postgres JSONB strategy base. `PgJsonbRepositoryExtension` is the name to
// prefer going forward; `PgRepositoryExtension` is kept as an alias for
// back-compat with existing `@pgExtension` classes.
export { PgRepositoryBase as PgJsonbRepositoryExtension } from './PgRepositoryBase'

/** @deprecated Use `PgJsonbRepositoryExtension`. */
export { PgRepositoryBase as PgRepositoryExtension } from './PgRepositoryBase'
