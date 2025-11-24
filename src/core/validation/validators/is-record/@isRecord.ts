import { container } from '@/core/injection'
import { ValidationMetadataStore } from '../../metadata/ValidationMetadataStore'
import { validateIsRecord } from './validateIsRecord'

export function isRecord(keyType: 'number' | 'string', valueType: 'number' | 'string' | 'boolean') {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateIsRecord,
      validatorOptions: { keyType, valueType },
    })
  }
}
