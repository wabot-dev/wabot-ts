import { Auth } from '@/core/auth'
import { IConstructor } from '@/core/generics'
import { container, Container, DependencyContainer } from '@/core/injection'
import { AgentBuilder, AgentFactory, AgentSession, IAgent } from '@/feature/agent'
import { ChatAdapter, IChatAdapter } from '@/feature/chat-bot'

import { MockChatAdapter } from './MockChatAdapter'

export interface IAgentHarnessOptions<A extends IChatAdapter> {
  /** The agent under test. */
  agent: IConstructor<IAgent>
  /** LLM adapter; defaults to a fresh MockChatAdapter. */
  adapter?: A
  /** Extra DI registrations for the agent's tool dependencies: [token, instance]. */
  register?: [any, any][]
  /** Assigned to the container-scoped Auth, like production does per request. */
  authInfo?: object
}

/**
 * Drives a real agent (real `AgentFactory` / `AgentOperator` / `AgentSession`,
 * system prompt, tool loop, validation and gating) against a pluggable,
 * scriptable adapter. It is a **thin wrapper over the production
 * `AgentFactory` path**, so tests exercise exactly what runs in production —
 * no parallel session logic to drift.
 *
 * ```ts
 * const harness = createAgentHarness({ agent: TriageAgent, register: [[Db, fakeDb]] })
 * harness.adapter.callTool(ANSWER_TOOL_NAME, { urgent: true })
 * const r = await harness.for().forMindset().allowTools([KbTools]).session().ask('…', Result)
 * assert.deepEqual(harness.adapter.lastRequest!.tools.map((t) => t.name), ['kbSearch'])
 * ```
 */
export class AgentHarness<A extends IChatAdapter = MockChatAdapter> {
  readonly adapter: A
  readonly container: DependencyContainer

  private factory: AgentFactory
  private agentCtor: IConstructor<IAgent>

  constructor(options: IAgentHarnessOptions<A>) {
    this.adapter = options.adapter ?? (new MockChatAdapter() as IChatAdapter as A)
    this.agentCtor = options.agent

    const child = container.createChildContainer()
    child.register(Container, { useValue: child })
    child.registerInstance(ChatAdapter, this.adapter as unknown as ChatAdapter)

    for (const [token, instance] of options.register ?? []) {
      child.registerInstance(token, instance)
    }

    if (options.authInfo) {
      const auth = child.resolve(Auth) as Auth<object>
      auth.assign(options.authInfo)
    }

    this.container = child
    this.factory = child.resolve(AgentFactory)
  }

  /**
   * The real production builder for the agent — chain
   * `forMindset()` / `allowTools()` / `denyTools()` / `withBudget()` /
   * `withContext()` then `session(context?)`. Same `AgentFactory.for(agent)`
   * used in production.
   */
  for(): AgentBuilder {
    return this.factory.for(this.agentCtor)
  }

  /** Shortcut for a session with default gating/budget: `for().session(context)`. */
  session(context?: string): AgentSession {
    return this.factory.for(this.agentCtor).session(context)
  }
}

export function createAgentHarness<A extends IChatAdapter = MockChatAdapter>(
  options: IAgentHarnessOptions<A>,
): AgentHarness<A> {
  return new AgentHarness(options)
}
