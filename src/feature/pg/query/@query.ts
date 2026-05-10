import { container } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { PgRepositoryMetadataStore } from './PgRepositoryMetadataStore'

export function query() {
  return function (target: object, propertyKey: string | symbol) {
    const store = container.resolve(PgRepositoryMetadataStore)
    store.saveQueryMethodMetadata({
      repositoryConstructor: target.constructor as IConstructor<any>,
      functionName: propertyKey.toString(),
    })
  }
}
