import { IConstructor } from "@/shared";
import { IMindset } from "../IMindset";
import { IParamConfig } from "./params/IParamConfig";
import { IMindsetFunctionConfig } from "./functions/IMindsetFunctionConfig";
import { IMindsetModuleConfig } from "./modules/IMindsetModuleConfig";
import { IMindsetConfig } from "./mindsets/IMindsetConfig";


export interface IMindsetFunctionParamMetadata {
  config: IParamConfig
  name: string
  type: Function
}

export interface IMindsetFunctionMetadata {
  requestConstructor?: Function
  name: string
  config: IMindsetFunctionConfig
  params: IMindsetFunctionParamMetadata[]
}

export interface IMindsetModuleMetadata{
  constructor: Function
  config: IMindsetModuleConfig
  functions: IMindsetFunctionMetadata[]
}

export interface IMindsetMetadata {
  constructor: IConstructor<IMindset>
  config: IMindsetConfig
  modules: IMindsetModuleMetadata[]
}