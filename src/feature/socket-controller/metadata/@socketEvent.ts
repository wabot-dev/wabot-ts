import { container } from '@/core/injection'
import { ISocketEventConfig } from './ISocketEventConfig'
import { SocketControllerMetadataStore } from './SocketControllerMetadataStore'

export function socketEvent(config: string | ISocketEventConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const functionName = propertyKey.toString()
    const paramsTypes = (Reflect as any).getMetadata('design:paramtypes', target, functionName)
    const store = container.resolve(SocketControllerMetadataStore)
    store.saveSocketEventMetadata({
      controllerConstructor: target.constructor as any,
      config: typeof config === 'string' ? { event: config } : config,
      functionName,
      paramsTypes,
    })
  }
}
