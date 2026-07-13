import { type IConstructor } from '@/core/generics'

export interface IAgentConfig {
  /** `@tools` classes this agent may call. */
  tools?: IConstructor<any>[]
  /**
   * Short, action-oriented description shown to a mindset's model when this
   * agent is exposed as a callable tool (via `@mindset({ agents })`). Tells the
   * mindset *when* to delegate to the agent. A per-binding `description`
   * overrides this.
   */
  description?: string
}
