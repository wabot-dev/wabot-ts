import 'reflect-metadata'

import { MindsetMetadataStore } from '../MindsetMetadataStore'
import { container } from '@/injection'
import { PARAM_DECORATION_PARAM } from './decoratorNames'
import { IParamConfig } from './IParamConfig'


export function param(config: IParamConfig): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    const paramName = propertyKey.toString()
    const paramType = Reflect.getMetadata('design:type', target, paramName)
    const store = container.resolve(MindsetMetadataStore)
    store.saveParamDecoration({
      decorationName: PARAM_DECORATION_PARAM,
      paramType: paramType,
      paramName: paramName,
      constructor: target.constructor,
      decorationConfig: config,
    })
  }
}
