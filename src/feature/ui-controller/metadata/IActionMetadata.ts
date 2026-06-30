import { IConstructor } from '@/core/generics'
import { IActionConfig } from './IActionConfig'

export interface IActionMetadata {
  controllerConstructor: IConstructor<any>
  functionName: string
  config?: IActionConfig
  paramsTypes: any[]
}
