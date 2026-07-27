import { Entity, IEntityData } from '@/core/entity'
import { CrudRepository, ReadRepository } from '@/core/repository'
import { PG_COLUMNS } from './pgEngine'

/**
 * A repository that declares Postgres' **column** storage: every entity field
 * is a real typed column, so queries and indexes are native. The table is owned
 * by SQL migrations — the framework conforms to it and never issues DDL.
 *
 * `@repository({ fields })` narrows it to a subset of the table's columns; omit
 * `fields` to read and write whatever the row carries. With no database
 * connected the memory backend serves it like any other repository.
 *
 * Declares nothing beyond the strategy: every inherited method is installed by
 * `@repository`, so there is no base behaviour to call or override.
 */
export class PgColumnsRepository<T extends Entity<IEntityData>, Ext = never> extends CrudRepository<
  T,
  Ext
> {
  static readonly storage = PG_COLUMNS
}

/** Read-only counterpart of {@link PgColumnsRepository} (a CQRS read model). */
export class PgColumnsReadRepository<
  T extends Entity<IEntityData>,
  Ext = never,
> extends ReadRepository<T, Ext> {
  static readonly storage = PG_COLUMNS
}
