import { Container, injectable } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { DescriptionMetadataStore } from '@/core/description'
import { ValidationMetadataStore } from '@/core/validation'
import { ChatAdapter } from '@/feature/chat-bot'
import { IMindsetModelKind, IMindsetModelRef, IMindsetModels } from '@/feature/mindset'
import { IToolInvokerOptions, ToolInvoker, ToolMetadataStore } from '@/feature/tool'
import { Agent } from './IAgent'
import { AgentMetadataStore } from './AgentMetadataStore'
import { AgentSession, IAgentBudget } from './AgentSession'

const MODEL_KIND_FALLBACK: Partial<Record<IMindsetModelKind, IMindsetModelKind>> = {
  visionLlm: 'llm',
  audioLlm: 'llm',
}

export interface IAgentSessionOptions {
  /** Initial context prepended to the agent's instructions. */
  context?: string
  /** Token / step limits for turns in this session. */
  budget?: IAgentBudget
  /** Tool gating for this session (allow / deny / mindset exposure). */
  toolPolicy?: IToolInvokerOptions
}

/**
 * Runtime for a single concrete {@link Agent}, resolved with the agent bound in
 * a DI (child) container. Turns the agent's instructions + `@tools` into
 * {@link AgentSession}s.
 */
@injectable()
export class AgentOperator {
  private toolClasses: IConstructor<any>[]

  constructor(
    private agent: Agent,
    private container: Container,
    agentMetadataStore: AgentMetadataStore,
    private toolMetadataStore: ToolMetadataStore,
    private descriptionStore: DescriptionMetadataStore,
    private validationStore: ValidationMetadataStore,
    private adapter: ChatAdapter,
  ) {
    const meta = agentMetadataStore.getAgentInfo(this.agent.constructor as any)
    this.toolClasses = meta.config?.tools ?? []
  }

  instructions(): Promise<string> {
    return this.agent.instructions()
  }

  models(): Promise<IMindsetModels> {
    return this.agent.models()
  }

  async resolveModels(kind: IMindsetModelKind): Promise<IMindsetModelRef[]> {
    const models = await this.models()
    const direct = models[kind]
    if (direct && direct.length > 0) return direct
    const fallbackKind = MODEL_KIND_FALLBACK[kind]
    if (fallbackKind) {
      const fallback = models[fallbackKind]
      if (fallback && fallback.length > 0) return fallback
    }
    return []
  }

  session(options: IAgentSessionOptions = {}): AgentSession {
    const toolInvoker = new ToolInvoker(
      this.toolClasses,
      this.container,
      this.toolMetadataStore,
      this.descriptionStore,
      options.toolPolicy ?? {},
    )
    return new AgentSession(
      {
        instructions: () => this.instructions(),
        resolveModels: (kind) => this.resolveModels(kind),
        adapter: this.adapter,
        toolInvoker,
        validationStore: this.validationStore,
        descriptionStore: this.descriptionStore,
      },
      { context: options.context, budget: options.budget },
    )
  }
}
