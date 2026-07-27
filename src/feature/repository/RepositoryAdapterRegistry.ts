import { singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IRepositoryAdapter } from './IRepositoryAdapter'
import { IDbPoolProvider } from './IDbPoolProvider'

/**
 * Maps each database (identified by its `@dbPool` provider class) to the adapter
 * that talks to it. The **default** provider's adapter is also the fallback for
 * repositories that don't set `pool`, and backs the non-repository services.
 */
@singleton()
export class RepositoryAdapterRegistry {
  private adapter: IRepositoryAdapter | null = null
  private byProvider = new Map<IConstructor<IDbPoolProvider>, IRepositoryAdapter>()

  setDefault(adapter: IRepositoryAdapter): void {
    this.adapter = adapter
  }

  getDefault(): IRepositoryAdapter {
    if (!this.adapter) {
      throw new Error(
        'No repository adapter registered. ' +
          'Register one with container.resolve(RepositoryAdapterRegistry).setDefault(adapter).',
      )
    }
    return this.adapter
  }

  hasDefault(): boolean {
    return this.adapter !== null
  }

  /** Bind a `@dbPool` provider class to the adapter for its database. */
  register(provider: IConstructor<IDbPoolProvider>, adapter: IRepositoryAdapter): void {
    this.byProvider.set(provider, adapter)
  }

  /** Adapter for a repository's `pool` provider. Throws if that database wasn't wired. */
  getForProvider(provider: IConstructor<IDbPoolProvider>): IRepositoryAdapter {
    const adapter = this.byProvider.get(provider)
    if (!adapter) {
      throw new Error(
        `No repository adapter registered for database provider "${provider.name}". ` +
          `Ensure it is decorated with @dbPool and imported (a repository that sets ` +
          `pool: ${provider.name} pulls it in), and that a database backend is active.`,
      )
    }
    return adapter
  }

  clear(): void {
    this.adapter = null
    this.byProvider.clear()
  }
}
