import { Container, injectable } from '@/core/injection'
import {
  type IMindsetIdentity,
  IMindsetModelKind,
  IMindsetModelRef,
  IMindsetModels,
  Mindset,
} from './IMindset'

import { MindsetMetadataStore } from './metadata/MindsetMetadataStore'
import {
  IMindsetCacheConfig,
  mindsetToolClasses,
  normalizeMindsetCache,
} from './metadata/mindsets/IMindsetConfig'
import { ILoadedMindset, MindsetCache } from './MindsetCache'
import { DescriptionMetadataStore } from '@/core/description'
import { IToolSchema, ToolInvoker, ToolMetadataStore } from '@/feature/tool'
import {
  IMindsetAgentTools,
  IMindsetAgentToolsProvider,
  MINDSET_AGENT_TOOLS_PROVIDER,
} from './IMindsetAgentToolsProvider'

const MODEL_KIND_FALLBACK: Partial<Record<IMindsetModelKind, IMindsetModelKind>> = {
  visionLlm: 'llm',
  audioLlm: 'llm',
}

@injectable()
export class MindsetOperator {
  private metadata: ReturnType<MindsetMetadataStore['getMindsetInfo']>
  private toolInvoker: ToolInvoker
  /** Agents this mindset may call autonomously, exposed as tools (if any). */
  private agentToolset?: IMindsetAgentTools
  private cacheConfig?: IMindsetCacheConfig
  /** Per-operator memo: one `describe()`+`models()` per message, across round-trips. */
  private loaded?: Promise<ILoadedMindset>

  constructor(
    private mindset: Mindset,
    container: Container,
    metadataStore: MindsetMetadataStore,
    toolMetadataStore: ToolMetadataStore,
    descriptionStore: DescriptionMetadataStore,
    private cache: MindsetCache,
  ) {
    this.metadata = metadataStore.getMindsetInfo(this.mindset.constructor as any)
    this.cacheConfig = normalizeMindsetCache(this.metadata.config?.cache)
    this.toolInvoker = new ToolInvoker(
      mindsetToolClasses(this.metadata.config),
      container,
      toolMetadataStore,
      descriptionStore,
    )

    const agents = this.metadata.config?.agents ?? []
    if (agents.length > 0) {
      // Reserve the module tool names so an agent tool can never shadow a real
      // `@tools` function. The provider is registered by the agent feature (which
      // is loaded, since declaring agents means importing agent classes).
      const reserved = new Set(this.toolInvoker.schema().map((t) => t.name))
      const provider = container.resolve<IMindsetAgentToolsProvider>(MINDSET_AGENT_TOOLS_PROVIDER)
      this.agentToolset = provider.create(agents, container, reserved)
    }
  }

  /**
   * Load the mindset's persona + models. Memoized per operator (so a message's
   * many model round-trips run `describe()`/`models()` once), and — when the
   * mindset opts in via `@mindset({ cache })` — reused process-globally per
   * mindset class through {@link MindsetCache}, honoring `revalidate`.
   */
  private load(): Promise<ILoadedMindset> {
    if (this.loaded) return this.loaded
    this.loaded = this.doLoad()
    return this.loaded
  }

  private async doLoad(): Promise<ILoadedMindset> {
    const cls = this.mindset.constructor
    if (this.cacheConfig) {
      const cached = this.cache.get(cls)
      if (cached && !this.isStale(cached)) return cached
    }
    const [description, models] = await Promise.all([
      this.mindset.describe(),
      this.mindset.models(),
    ])
    const loaded: ILoadedMindset = { description, models, generatedAt: Date.now() }
    if (this.cacheConfig) this.cache.set(cls, loaded)
    return loaded
  }

  private isStale(loaded: ILoadedMindset): boolean {
    const ttl = this.cacheConfig?.revalidate
    return ttl != null && Date.now() - loaded.generatedAt >= ttl * 1000
  }

  async identity(): Promise<IMindsetIdentity> {
    return (await this.load()).description.identity
  }

  async models(): Promise<IMindsetModels> {
    return (await this.load()).models
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

  async systemPrompt(): Promise<string> {
    const description = (await this.load()).description
    let { context, skills, limits, workflow } = description
    const identity = description.identity

    const language = identity.language.replaceAll('#', ' ')
    const name = identity.name.replaceAll('#', ' ')
    const personality = identity.personality ? identity.personality.replaceAll('#', ' ') : null

    context = context.replaceAll('#', ' ')
    skills = skills.replaceAll('#', ' ')
    limits = limits.replaceAll('#', ' ')
    workflow = workflow.replaceAll('#', ' ')

    const systemPrompt = `
      # System Instructions
      you should act as a assistant.
      your main language is ${language}.
      your name is ${name}.

      ${personality ? '## Personality (in your main language) \n' + personality : ''}

      ## Context (in your main language)
      ${context}

      ## Skills (in your main language)
      ${skills}

      ## Workflow (in your main language)
      ${workflow}

      ## System limitations (in your main language)
      ${limits}

      ## Chat memory
      Next you will receive a chat history,
      you should use this information to answer the user.
    `
    return systemPrompt
  }

  tools(): IToolSchema[] {
    const toolSchemas = this.toolInvoker.schema()
    if (!this.agentToolset) return toolSchemas
    return [...toolSchemas, ...this.agentToolset.schema()]
  }

  callFunction(name: string, params: string): Promise<string> {
    if (this.agentToolset?.has(name)) return this.agentToolset.call(name, params)
    return this.toolInvoker.call(name, params)
  }
}
