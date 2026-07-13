import { type IConstructor } from '@/core/generics'
import { container, injectable } from '@/core/injection'
import { type IAgent } from './IAgent'
import { AgentMetadataStore } from './AgentMetadataStore'
import { type IAgentConfig } from './IAgentConfig'

export function agent(config?: IAgentConfig) {
  return function (target: IConstructor<IAgent>) {
    const store = container.resolve(AgentMetadataStore)
    store.saveAgentMetadata({ constructor: target, config })
    injectable()(target)
  }
}
