import { IConstructor } from '@/core/generics'
import { IEndPointConfig } from './IEndPointConfig'

export interface IEndPointMetadata {
  method: 'get' | 'post' | 'put' | 'delete'
  config?: IEndPointConfig
  controllerConstructor: IConstructor<any>
  functionName: string
  paramsTypes: any[]
}
