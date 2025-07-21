import { type IConstructor } from '@/core'
import { container } from 'tsyringe'
import { ValidationMetadataStore } from './ValidationMetadataStore'
import { validateModel } from '../validators/validateModel'

export function validable<A>() {
  return function (target: IConstructor<A>) {
    // Add static method to the constructor
    ;(target as any).__validate__ = function (value: any) {
      const info = container.resolve(ValidationMetadataStore).getModelValidatorsInfo(target)
      return validateModel(value, info)
    }
  }
}
