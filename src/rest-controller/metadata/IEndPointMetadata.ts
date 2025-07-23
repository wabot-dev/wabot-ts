import { IConstructor } from '@/core'

export interface IEndPointMetadata {
  method: 'get' | 'post'
  path?: string
  controllerConstructor: IConstructor<any>
  functionName: string
  paramsTypes: any[]
}
