import { Pool } from 'pg'

import { Entity, IEntityData } from '@/core/entity'
import { container, injectable } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { PgCrudRepository } from '../PgCrudRepository'
import { PgRepositoryMetadataStore } from './PgRepositoryMetadataStore'

@injectable()
export class PgJsonRepository<P extends Entity<IEntityData>> extends PgCrudRepository<P> {
  constructor(pool: Pool) {
    const ctor = new.target as IConstructor<any>
    const store = container.resolve(PgRepositoryMetadataStore)
    const config = store.getRepositoryConfig(ctor)
    if (!config) {
      throw new Error(
        `${ctor.name} must be decorated with @pgJsonRepository`,
      )
    }
    super(pool, config)
  }
}
