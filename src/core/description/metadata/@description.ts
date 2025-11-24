import { container } from '@/core/injection'
import { DescriptionMetadataStore } from './DescriptionMetadataStore'

export function description(description: string) {
  return (target: any, propertyKey: string | symbol) => {
    const propertyName = propertyKey.toString()
    const propertyType = Reflect.getMetadata('design:type', target, propertyName)
    const functionArgsTypes = Reflect.getMetadata('design:paramtypes', target, propertyName)
    const store = container.resolve(DescriptionMetadataStore)
    store.saveDescriptionMetadata({
      constructor: target.constructor,
      propertyName,
      propertyType,
      functionArgsTypes,
      functionReturnType: undefined,
      description
    })
  }
}
