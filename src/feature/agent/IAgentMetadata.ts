import { type IConstructor } from '@/core/generics'
import { type IAgent } from './IAgent'
import { type IAgentConfig } from './IAgentConfig'

export interface IAgentMetadata {
  constructor: IConstructor<IAgent>
  config?: IAgentConfig
}
