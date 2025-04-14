import { IConstructor } from "@/shared"
import { IMindsetFunction, IMindsetFunctionParams } from "./IMindsetFunction"
import { IMindset } from "./IMindset"

export interface IMindsetConfig {
  functions?: IConstructor<IMindsetFunction<IMindsetFunctionParams>>[]
}

export function mindset(config: IMindsetConfig)   {
  return function (target: IConstructor<IMindset>) {
    console.log(`Class defined: ${target.name}`)
  }
}
