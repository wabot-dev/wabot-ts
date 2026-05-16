import { singleton } from '@/core/injection'
import { IRepositoryAdapter } from './IRepositoryAdapter'

@singleton()
export class RepositoryAdapterRegistry {
  private adapter: IRepositoryAdapter | null = null

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

  clear(): void {
    this.adapter = null
  }
}
