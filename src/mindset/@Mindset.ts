import { IConstructor } from '@/shared'
import { IMindsetFunction, IMindsetFunctionParams } from './IMindsetFunction'
import { IMindset } from './IMindset'
import { injectable } from '@/injection'

export interface IMindsetConfig {
  functions?: IConstructor<IMindsetFunction<IMindsetFunctionParams>>[]
}

export function mindset(config: IMindsetConfig) {
  return function (target: IConstructor<IMindset>) {
    injectable()(target)
    console.log(`Class defined: ${target.name}`)
  }
}
