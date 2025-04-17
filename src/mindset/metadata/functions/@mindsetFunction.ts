import 'reflect-metadata'

import { container } from '@/injection'
import { MindsetMetadataStore } from '../MindsetMetadataStore'
import { MINDSET_FUNCTION_DECORATION_FUNCTION } from './decoratorNames'
import { IMindsetFunctionConfig } from './IMindsetFunctionConfig'


export function mindsetFunction(config: IMindsetFunctionConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const functionName = propertyKey.toString()
    const paramsTypes = Reflect.getMetadata('design:paramtypes', target, functionName)
    const store = container.resolve(MindsetMetadataStore)
    store.saveFunctionDecoration({
      decorationName: MINDSET_FUNCTION_DECORATION_FUNCTION,
      paramsTypes: paramsTypes,
      functionName,
      constructor: target.constructor,
      decorationConfig: config,
    })
  }
}
