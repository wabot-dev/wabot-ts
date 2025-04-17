import { IConstructor } from "@/shared";
import { IMindset } from "../IMindset";
import { IMindsetConfig } from "./@mindset";
import { IMindsetModuleConfig } from "./modules/@mindsetModule";
import { IMindsetFunctionConfig } from "./functions";
import { IParamConfig } from "./params";


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