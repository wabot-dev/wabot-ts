import { type IConstructor } from '@/shared'
import { type IMindset } from '../IMindset'
import { type IParamConfig } from './params/IParamConfig'
import { type IMindsetFunctionConfig } from './functions/IMindsetFunctionConfig'
import { type IMindsetModuleConfig } from './modules/IMindsetModuleConfig'
import { type IMindsetConfig } from './mindsets/IMindsetConfig'

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
