import { container } from '@/core/injection'
import { ITransactionAdapter } from './ITransactionAdapter'
import { TransactionMetadataStore } from './TransactionMetadataStore'

export function transaction(dbNames?: readonly string[]) {
  return function <This, A extends unknown[], R>(
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(this: This, ...args: A) => Promise<R>>,
  ): TypedPropertyDescriptor<(this: This, ...args: A) => Promise<R>> {
    const originalMethod = descriptor.value!
    const store = container.resolve(TransactionMetadataStore)

    descriptor.value = function (this: This, ...args: A): Promise<R> {
      const adapters = dbNames ? store.requireAdapters(dbNames) : store.getAllAdapters()
      return runInTransactions(adapters, () => originalMethod.apply(this, args))
    }

    return descriptor
  }
}

function runInTransactions<T>(
  adapters: readonly ITransactionAdapter[],
  fn: () => Promise<T>,
): Promise<T> {
  if (adapters.length === 0) return fn()
  const composed = adapters.reduceRight<() => Promise<T>>(
    (next, adapter) => () => adapter.run(next),
    fn,
  )
  return composed()
}
