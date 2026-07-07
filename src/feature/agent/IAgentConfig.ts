import { type IConstructor } from '@/core/generics'

export interface IAgentConfig {
  /** `@tools` classes this agent may call. */
  tools?: IConstructor<any>[]
}
