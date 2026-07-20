import { container, singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { DbPoolMetadataStore } from './DbPoolMetadataStore'
import { IDbPoolProvider } from './IDbPoolProvider'

/**
 * Mark a class as a database pool provider. A repository selects it by reference
 * — `@repository({ pool: MyPool })` — so the framework knows which connection to
 * use. Applies `@singleton()`; the runner resolves the provider through DI and
 * builds exactly one tuned pool per provider class.
 */
export function dbPool() {
  return function (target: IConstructor<IDbPoolProvider>) {
    container.resolve(DbPoolMetadataStore).register(target)
    singleton()(target)
  }
}
