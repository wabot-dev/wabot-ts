import { IConstructor } from '@/core/generics'
import { CrudRepository } from '@/core/repository'
import { DB_EXTENSION_ID, dbExtension } from '@/feature/repository'

/**
 * @deprecated Use `DB_EXTENSION_ID` from `@/feature/repository`. Kept as an
 * alias — the Postgres adapter now registers under the shared db-extension slot.
 */
export const PG_ADAPTER_ID = DB_EXTENSION_ID

/**
 * @deprecated Use `@dbExtension` and extend `PgJsonbRepositoryExtension`.
 * Thin alias so existing Postgres extensions keep registering under the db slot.
 */
export function pgExtension<R extends CrudRepository<any, any>>(repositoryClass: IConstructor<R>) {
  return dbExtension(repositoryClass)
}
