import { container } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { RepositoryMetadataStore } from './RepositoryMetadataStore'

export function queryExtension() {
  return function (target: object, propertyKey: string | symbol, descriptor?: PropertyDescriptor) {
    const functionName = propertyKey.toString()
    const ctor = target.constructor as IConstructor<any>

    const value = descriptor ? descriptor.value : (target as any)[propertyKey]
    if (value !== undefined && typeof value !== 'function') {
      throw new Error(
        `@queryExtension() on ${ctor.name}.${functionName}: ` +
          `decorated property must be a function (typically a declare).`,
      )
    }

    const store = container.resolve(RepositoryMetadataStore)
    store.saveExtensionMethodMetadata({
      repositoryConstructor: ctor,
      functionName,
    })
  }
}
