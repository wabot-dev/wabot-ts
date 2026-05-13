import { container } from '@/core/injection'
import { TransactionMetadataStore } from './TransactionMetadataStore'

export function transaction(dbName?: string) {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value

    descriptor.value = function (...args: any[]) {
      const store = container.resolve(TransactionMetadataStore)
      const adapter = store.requireAdapter(dbName ?? 'default')
      return adapter.run(() => originalMethod.apply(this, args))
    }

    return descriptor
  }
}
