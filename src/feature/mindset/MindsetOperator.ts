import { Container, injectable } from '@/core/injection'
import {
  type IMindset,
  type IMindsetIdentity,
  IMindsetLlm,
  IMindsetModelKind,
  IMindsetModelRef,
  IMindsetModels,
  Mindset,
} from './IMindset'

import { MindsetMetadataStore } from './metadata/MindsetMetadataStore'
import { DescriptionMetadataStore } from '@/core/description'
import { IToolSchema, ToolInvoker, ToolMetadataStore } from '@/feature/tool'

const MODEL_KIND_FALLBACK: Partial<Record<IMindsetModelKind, IMindsetModelKind>> = {
  visionLlm: 'llm',
  audioLlm: 'llm',
}

@injectable()
export class MindsetOperator implements IMindset {
  private metadata: ReturnType<MindsetMetadataStore['getMindsetInfo']>
  private toolInvoker: ToolInvoker

  constructor(
    private mindset: Mindset,
    container: Container,
    metadataStore: MindsetMetadataStore,
    toolMetadataStore: ToolMetadataStore,
    descriptionStore: DescriptionMetadataStore,
  ) {
    this.metadata = metadataStore.getMindsetInfo(this.mindset.constructor as any)
    this.toolInvoker = new ToolInvoker(
      this.metadata.config?.modules ?? [],
      container,
      toolMetadataStore,
      descriptionStore,
    )
  }

  context(): Promise<string> {
    return this.mindset.context()
  }

  identity(): Promise<IMindsetIdentity> {
    return this.mindset.identity()
  }

  skills(): Promise<string> {
    return this.mindset.skills()
  }

  limits(): Promise<string> {
    return this.mindset.limits()
  }

  workflow(): Promise<string> {
    return this.mindset.workflow()
  }

  /** @deprecated use {@link MindsetOperator.models} */
  async llms(): Promise<IMindsetLlm[]> {
    if (this.mindset.llms) return this.mindset.llms()
    const models = await this.models()
    return models.llm ?? []
  }

  async models(): Promise<IMindsetModels> {
    if (this.mindset.models) return this.mindset.models()
    if (this.mindset.llms) return { llm: await this.mindset.llms() }
    throw new Error(
      `Invalid ${this.mindset.constructor.name} - models() or llms() must be implemented`,
    )
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
    let [context, identity, skills, limits, workflow] = await Promise.all([
      this.context(),
      this.identity(),
      this.skills(),
      this.limits(),
      this.workflow(),
    ])

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
    return this.toolInvoker.schema()
  }

  callFunction(name: string, params: string): Promise<string> {
    return this.toolInvoker.call(name, params)
  }
}
