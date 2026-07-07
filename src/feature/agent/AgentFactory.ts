import { Container, injectable } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IToolRef } from '@/feature/tool'
import { Agent, IAgent } from './IAgent'
import { AgentOperator } from './AgentOperator'
import { AgentSession, IAgentBudget } from './AgentSession'

/**
 * Entry point for using agents. Resolves an {@link AgentOperator} for a concrete
 * agent class by binding it in a child DI container, and offers a fluent builder
 * to control tool access, budget and context — the guarantees a mindset needs
 * when it delegates to an agent.
 */
@injectable()
export class AgentFactory {
  constructor(private container: Container) {}

  for(agentCtor: IConstructor<IAgent>): AgentBuilder {
    return new AgentBuilder(this.container, agentCtor)
  }
}

export class AgentBuilder {
  private allow?: IToolRef[]
  private deny?: IToolRef[]
  private budget?: IAgentBudget
  private context?: string
  private mindsetScoped = false

  constructor(
    private container: Container,
    private agentCtor: IConstructor<IAgent>,
  ) {}

  /**
   * Enforce mindset exposure rules: tools declared `exposeToMindsets: false`
   * are hidden unless explicitly allow-listed. Use this on the mindset→agent
   * delegation path to guarantee an end-user-driven mindset can never reach
   * privileged agent tools.
   */
  forMindset(): this {
    this.mindsetScoped = true
    return this
  }

  /** Restrict this session to only the given tools (classes or function names). */
  allowTools(refs: IToolRef[]): this {
    this.allow = [...(this.allow ?? []), ...refs]
    return this
  }

  /** Forbid the given tools (classes or function names) in this session. */
  denyTools(refs: IToolRef[]): this {
    this.deny = [...(this.deny ?? []), ...refs]
    return this
  }

  /** Cap tokens / steps for turns in this session. */
  withBudget(budget: IAgentBudget): this {
    this.budget = budget
    return this
  }

  /** Set the initial context (also settable as an argument to {@link session}). */
  withContext(context: string): this {
    this.context = context
    return this
  }

  session(context?: string): AgentSession {
    const child = this.container.createChildContainer()
    child.register(Container, { useValue: child })
    child.register(Agent, { useClass: this.agentCtor })
    const operator = child.resolve(AgentOperator)
    return operator.session({
      context: context ?? this.context,
      budget: this.budget,
      toolPolicy: {
        forMindset: this.mindsetScoped,
        allow: this.allow,
        deny: this.deny,
      },
    })
  }
}
