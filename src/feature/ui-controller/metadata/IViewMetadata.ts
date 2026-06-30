import { IConstructor } from '@/core/generics'
import { IViewConfig } from './IViewConfig'

export interface IViewMetadata {
  controllerConstructor: IConstructor<any>
  functionName: string
  config?: IViewConfig
  paramsTypes: any[]
}
