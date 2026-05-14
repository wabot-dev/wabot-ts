import { singleton } from '@/core/injection'
import { ITransactionAdapter } from './ITransactionAdapter'

@singleton()
export class TransactionMetadataStore {
  private adapters = new Map<string, ITransactionAdapter>()

  registerAdapter(dbName: string, adapter: ITransactionAdapter): void {
    this.adapters.set(dbName, adapter)
  }

  requireAdapter(dbName: string): ITransactionAdapter {
    const adapter = this.adapters.get(dbName)
    if (!adapter) {
      throw new Error(
        `No transaction adapter registered for "${dbName}". ` +
          `Register one with container.resolve(TransactionMetadataStore).registerAdapter("${dbName}", adapter)`,
      )
    }
    return adapter
  }

  requireAdapters(dbNames: readonly string[]): ITransactionAdapter[] {
    return dbNames.map((name) => this.requireAdapter(name))
  }

  getAllAdapters(): ITransactionAdapter[] {
    return Array.from(this.adapters.values())
  }
}
