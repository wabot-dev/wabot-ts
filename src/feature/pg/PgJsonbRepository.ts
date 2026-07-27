import { Entity, IEntityData } from '@/core/entity'
import { CrudRepository, ReadRepository } from '@/core/repository'
import { PG_JSONB } from './pgEngine'

/**
 * A repository that declares Postgres' **document** storage: the entity is kept
 * as one JSONB blob in a table the framework creates and indexes itself, so no
 * migration is needed to add a field.
 *
 * This is what plain `CrudRepository` already gets under Postgres; extend this
 * instead when you want the choice written down at the repository, next to the
 * `@repository` config. With no database connected the memory backend serves it
 * all the same.
 *
 * Declares nothing beyond the strategy: every inherited method is installed by
 * `@repository`, so there is no base behaviour to call or override.
 */
export class PgJsonbRepository<T extends Entity<IEntityData>, Ext = never> extends CrudRepository<
  T,
  Ext
> {
  static readonly storage = PG_JSONB
}

/** Read-only counterpart of {@link PgJsonbRepository} (a CQRS read model). */
export class PgJsonbReadRepository<
  T extends Entity<IEntityData>,
  Ext = never,
> extends ReadRepository<T, Ext> {
  static readonly storage = PG_JSONB
}
