import { IConstructor } from '@/core/generics'
import { ISocketControllerConfig } from './ISocketControllerConfig'

export interface ISocketControllerMetadata {
  controllerConstructor: IConstructor<any>
  config?: ISocketControllerConfig
}
