import { type IConstructor } from '@/core/generics'
import { type IMindset } from '../IMindset'
import { type IMindsetFunctionConfig } from './functions/IMindsetFunctionConfig'
import { type IMindsetConfig } from './mindsets/IMindsetConfig'
import { type IMindsetModuleConfig } from './modules/IMindsetModuleConfig'
import { type IParamConfig } from './params/IParamConfig'

export interface IMindsetFunctionParamMetadata {
  config: IParamConfig
  name: string
  type: Function
}

export interface IMindsetFunctionMetadata {
  moduleConstructor: Function
  requestConstructor?: Function
  name: string
  config: IMindsetFunctionConfig
  params: IMindsetFunctionParamMetadata[]
}

export interface IMindsetModuleMetadata {
  constructor: Function
  config: IMindsetModuleConfig
  functions: IMindsetFunctionMetadata[]
}

export interface IMindsetMetadata {
  constructor: IConstructor<IMindset>
  config: IMindsetConfig
  modules: IMindsetModuleMetadata[]
}
