import { container } from '@/core/injection'
import { ISocketConnectionConfig as ISocketConnectionConfig } from './ISocketConnectionConfig'
import { SocketControllerMetadataStore } from './SocketControllerMetadataStore'

export function socketConnection(config?: string | ISocketConnectionConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const functionName = propertyKey.toString()
    const paramsTypes = (Reflect as any).getMetadata('design:paramtypes', target, functionName)
    const store = container.resolve(SocketControllerMetadataStore)
    store.saveSocketConnectionMetadata({
      controllerConstructor: target.constructor as any,
      config: typeof config === 'string' ? { namespace: config } : config,
      functionName,
      paramsTypes,
    })
  }
}
