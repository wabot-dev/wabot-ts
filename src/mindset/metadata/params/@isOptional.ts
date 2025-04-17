import 'reflect-metadata'

import { MindsetMetadataStore } from '../MindsetMetadataStore'
import { container } from '@/injection'

export const PARAM_DECORATION_IS_OPTIONAL = 'isOptional'

export const isOptionalAction = (value: any) => {}

export function isOptional(): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    debugger
    const paramName = propertyKey.toString()
    const paramType = Reflect.getMetadata('design:type', target, paramName)
    const store = container.resolve(MindsetMetadataStore)
    store.saveParamDecoration({
      decorationName: PARAM_DECORATION_IS_OPTIONAL,
      paramType: paramType,
      paramName: paramName,
      constructor: target.constructor,
      decorationConfig: {}
    })
  }
}
