import { singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IAgent } from './IAgent'
import { IAgentMetadata } from './IAgentMetadata'

@singleton()
export class AgentMetadataStore {
  private readonly agents = new Map<Function, IAgentMetadata>()

  public saveAgentMetadata(metadata: IAgentMetadata): void {
    this.agents.set(metadata.constructor, metadata)
  }

  public getAgentInfo(agentCtor: IConstructor<IAgent>) {
    const agent = this.agents.get(agentCtor)
    if (!agent) {
      throw new Error(`not found agent info for ${agentCtor.name}`)
    }
    return {
      config: agent.config,
    }
  }
}
