import { type IConstructor } from '@/core/generics'
import { tools } from '@/feature/tool'
import { type IMindsetModuleConfig } from './IMindsetModuleConfig'

/** @deprecated use `@tools` from `@/feature/tool`. Mindset modules are now tools. */
export function mindsetModule<A>(config?: IMindsetModuleConfig) {
  return function (target: IConstructor<A>) {
    tools<A>(config)(target)
  }
}
