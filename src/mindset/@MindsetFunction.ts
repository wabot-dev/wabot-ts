import { IConstructor } from "@/shared"
import { IMindsetFunction, IMindsetFunctionParams } from "./IMindsetFunction"

export interface IMindsetFunctionConfig {
  description: string;
}

export function mindsetFunction<A extends IMindsetFunctionParams>(config: IMindsetFunctionConfig)  {
  return function (target: IConstructor<IMindsetFunction<A>>) {
    console.log(`Class defined: ${target.name}`)
  }
}
