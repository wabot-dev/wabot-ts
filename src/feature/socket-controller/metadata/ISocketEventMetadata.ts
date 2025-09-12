import { IConstructor } from '@/core/generics'
import { ISocketEventConfig } from './ISocketEventConfig'

export interface ISocketEventMetadata {
  config: ISocketEventConfig
  controllerConstructor: IConstructor<any>
  functionName: string
  paramsTypes: any[]
}
