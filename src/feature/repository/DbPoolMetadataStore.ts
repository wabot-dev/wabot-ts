import { singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IDbPoolProvider } from './IDbPoolProvider'

/** Registry of `@dbPool`-decorated provider classes, for boot-time validation. */
@singleton()
export class DbPoolMetadataStore {
  private providers = new Set<Function>()

  register(ctor: IConstructor<IDbPoolProvider>): void {
    this.providers.add(ctor)
  }

  isProvider(ctor: Function): boolean {
    return this.providers.has(ctor)
  }

  clear(): void {
    this.providers.clear()
  }
}
