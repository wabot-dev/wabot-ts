import { container } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { parseQueryMethodName } from './parseQueryMethodName'
import { RepositoryMetadataStore } from './RepositoryMetadataStore'

export function query() {
  return function (target: object, propertyKey: string | symbol, descriptor?: PropertyDescriptor) {
    const functionName = propertyKey.toString()
    const ctor = target.constructor as IConstructor<any>

    parseQueryMethodName(functionName)

    const value = descriptor ? descriptor.value : (target as any)[propertyKey]
    if (value !== undefined && typeof value !== 'function') {
      throw new Error(
        `@query() on ${ctor.name}.${functionName}: decorated property must be a function`,
      )
    }

    const store = container.resolve(RepositoryMetadataStore)
    store.saveQueryMethodMetadata({
      repositoryConstructor: ctor,
      functionName,
    })
  }
}
