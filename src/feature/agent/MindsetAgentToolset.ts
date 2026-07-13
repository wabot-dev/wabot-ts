import { Container, container as rootContainer, singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { CustomError } from '@/core/error'
import { Logger } from '@/core/logger'
import { IToolRef, IToolSchema } from '@/feature/tool'
import {
  IMindsetAgentTools,
  IMindsetAgentToolsProvider,
  MINDSET_AGENT_TOOLS_PROVIDER,
} from '@/feature/mindset'
import { IAgent } from './IAgent'
import { AgentFactory } from './AgentFactory'
import { AgentMetadataStore } from './AgentMetadataStore'
import { IAgentBudget } from './AgentSession'

/**
 * How a mindset exposes one agent to its own model. Either the bare agent class
 * (defaults) or an object with per-agent control over which of the agent's tools
 * are reachable, the tool name/description the model sees, and a budget.
 */
export type IMindsetAgentBinding =
  | IConstructor<IAgent>
  | {
      /** The agent class to expose. */
      agent: IConstructor<IAgent>
      /** Restrict the agent to only these of its tools (classes or fn names). */
      allow?: IToolRef[]
      /** Forbid these of the agent's tools (classes or fn names). */
      deny?: IToolRef[]
      /** Tool name the mindset's model calls. Defaults to `ask_<agent_slug>`. */
      name?: string
      /** Description shown to the model. Defaults to `@agent({ description })`. */
      description?: string
      /** Token/step cap per call. Defaults to {@link DEFAULT_MINDSET_AGENT_BUDGET}. */
      budget?: IAgentBudget
    }

/**
 * Conservative default cap applied when a mindset calls an agent on its own, so
 * an autonomous delegation can never run away on cost. Overridable per binding.
 */
export const DEFAULT_MINDSET_AGENT_BUDGET: IAgentBudget = { maxTokens: 4000, maxSteps: 8 }

interface INormalizedBinding {
  agentCtor: IConstructor<IAgent>
  toolName: string
  description: string
  allow?: IToolRef[]
  deny?: IToolRef[]
  budget: IAgentBudget
}

/**
 * Turns a mindset's `agents` bindings into callable tools: each agent becomes a
 * single-input ("free-text task") tool in the mindset's schema, and a call spins
 * a **fresh, isolated** agent session (mindset exposure rules enforced, budget
 * capped, no chat history forwarded) and returns the agent's reply text.
 */
export class MindsetAgentToolset implements IMindsetAgentTools {
  private logger = new Logger('wabot:mindset-agents')
  private byName = new Map<string, INormalizedBinding>()

  constructor(
    bindings: IMindsetAgentBinding[],
    private agentFactory: AgentFactory,
    metadataStore: AgentMetadataStore,
    private reservedNames: Set<string> = new Set(),
  ) {
    for (const raw of bindings) {
      const b = normalize(raw, metadataStore)
      if (this.reservedNames.has(b.toolName) || this.byName.has(b.toolName)) {
        throw new Error(
          `Mindset agent tool name '${b.toolName}' collides with another tool; ` +
            `set a unique \`name\` on the agent binding.`,
        )
      }
      this.byName.set(b.toolName, b)
    }
  }

  names(): string[] {
    return [...this.byName.keys()]
  }

  has(name: string): boolean {
    return this.byName.has(name)
  }

  schema(): IToolSchema[] {
    return [...this.byName.values()].map((b) => ({
      language: 'english',
      name: b.toolName,
      description: b.description,
      parameters: [
        {
          name: 'input',
          required: true,
          schema: {
            type: 'string' as const,
            description:
              'The task or question to delegate to the agent, in natural language. ' +
              'Include everything the agent needs — it does not see the chat history.',
          },
        },
      ],
    }))
  }

  async call(name: string, params: string): Promise<string> {
    const binding = this.byName.get(name)
    if (!binding) {
      throw new CustomError({
        httpCode: 400,
        code: 'AGENT_TOOL_NOT_FOUND',
        message: `Agent tool '${name}' is not registered on this mindset`,
      })
    }

    let input: unknown
    try {
      input = JSON.parse(params || '{}')
    } catch {
      return JSON.stringify({
        error: 'INVALID_JSON_ARGUMENTS',
        message: 'Arguments must be a JSON object like {"input":"..."}.',
      })
    }
    const task = (input as any)?.input
    if (typeof task !== 'string' || !task.trim()) {
      return JSON.stringify({
        error: 'INVALID_ARGUMENTS',
        message: 'Provide a non-empty "input" string describing the task for the agent.',
      })
    }

    // Fresh, isolated session per call: mindset exposure rules on, budget capped,
    // only the task text as context (no chat history).
    let builder = this.agentFactory.for(binding.agentCtor).forMindset().withBudget(binding.budget)
    if (binding.allow) builder = builder.allowTools(binding.allow)
    if (binding.deny) builder = builder.denyTools(binding.deny)

    try {
      const reply = await builder.session().order(task)
      if (reply.type === 'stopped') {
        this.logger.warn(`Agent tool '${name}' stopped early (${reply.reason})`)
        return reply.text?.trim()
          ? `${reply.text}\n\n(Note: the agent stopped before fully finishing: ${reply.reason}.)`
          : `The agent could not finish the task (${reply.reason}).`
      }
      return reply.text ?? ''
    } catch (error) {
      this.logger.error(`Agent tool '${name}' threw`, error as any)
      return JSON.stringify({
        error: 'AGENT_FAILED',
        message: error instanceof Error ? error.message : 'The agent failed to run.',
      })
    }
  }
}

/** The object binding form (bare class is widened to `{ agent }`). */
type IMindsetAgentBindingObject = Exclude<IMindsetAgentBinding, IConstructor<IAgent>>

function normalize(raw: IMindsetAgentBinding, store: AgentMetadataStore): INormalizedBinding {
  const opts: IMindsetAgentBindingObject = typeof raw === 'function' ? { agent: raw } : raw
  const agentCtor = opts.agent
  const config = store.getAgentInfo(agentCtor).config
  const description = opts.description ?? config?.description
  if (!description) {
    throw new Error(
      `Agent ${agentCtor.name} is exposed to a mindset but has no description. ` +
        `Add one via the binding (\`description\`) or \`@agent({ description })\`.`,
    )
  }
  return {
    agentCtor,
    toolName: opts.name ?? defaultToolName(agentCtor),
    description,
    allow: opts.allow,
    deny: opts.deny,
    budget: opts.budget ?? DEFAULT_MINDSET_AGENT_BUDGET,
  }
}

/** `SlotAdvisorAgent` → `ask_slot_advisor`. */
function defaultToolName(ctor: IConstructor<IAgent>): string {
  const base = ctor.name.replace(/Agent$/, '') || ctor.name
  const snake = base
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '')
  return `ask_${snake}`
}

/**
 * Implementation of the mindset-feature's {@link IMindsetAgentToolsProvider},
 * registered under {@link MINDSET_AGENT_TOOLS_PROVIDER} so `MindsetOperator` can
 * build agent tools via a DI token without importing the agent feature.
 */
@singleton()
export class MindsetAgentToolsProvider implements IMindsetAgentToolsProvider {
  constructor(private metadataStore: AgentMetadataStore) {}

  create(
    bindings: IMindsetAgentBinding[],
    container: Container,
    reservedNames: Set<string>,
  ): IMindsetAgentTools {
    return new MindsetAgentToolset(
      bindings,
      container.resolve(AgentFactory),
      this.metadataStore,
      reservedNames,
    )
  }
}

// Register the provider when the agent feature loads (declaring `agents` on a
// mindset imports agent classes, which pulls this module in).
rootContainer.register(MINDSET_AGENT_TOOLS_PROVIDER, { useClass: MindsetAgentToolsProvider })
