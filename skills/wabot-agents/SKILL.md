---
name: wabot-agents
description: Use when building dev-facing agents, asking an LLM for a typed/deterministic answer or yes/no, giving orders, or letting a mindset delegate to an agent with controlled context and tool access. Covers @agent, IAgent, AgentFactory, AgentSession (ask / confirm / order), typed structured output, AgentReply (answer / question / stopped), context attachments (attachChat / attachMessage — e.g. "should the bot respond?"), the shared @tools decorator, and tool gating (allowTools / denyTools / exposeToMindsets / budget).
---

# Agents & shared tools

Two ways to drive an LLM in Wabot:

- **Mindset** (`wabot-mindset`) — an end-user-facing chatbot persona with chat memory. The *user* talks to it.
- **Agent** — a **dev-facing** primitive you drive from code: give it context, ask typed questions, give orders. No persisted chat memory; the transcript lives only in the session.

Both consume the same **tools**.

## Tools are shared — `@tools`

A tool class is a class decorated with `@tools()`; every method decorated with `@description(...)` becomes an LLM-callable function (at most one validated request-class parameter — see `wabot-validation`). The exact mechanics are documented in `wabot-mindset` under "tool functions".

```typescript
import { description, isNumber, tools } from '@wabot-dev/framework'

export class AccountRef {
  @isNumber()
  @description('The account id to look up')
  id!: number
}

@tools()
export class AccountTools {
  constructor(private accounts: AccountRepository) {}

  @description('Return the current balance of an account')
  async getBalance(req: AccountRef) {
    return this.accounts.balance(req.id)
  }
}
```

`@mindsetModule` is now a **deprecated alias** of `@tools` — existing modules keep working. `@tools({ language?, exposeToMindsets? })`: `exposeToMindsets: false` marks the class agent-only so a mindset can never reach it through delegation (see gating below).

The same `@tools` class can be listed by both a mindset (`@mindset({ modules: [...] })`) and an agent (`@agent({ tools: [...] })`).

## Define an agent — `@agent`

```typescript
import { agent, type IAgent, type IMindsetModels } from '@wabot-dev/framework'

@agent({ tools: [AccountTools] })
export class SupportAgent implements IAgent {
  async instructions(): Promise<string> {
    return 'You are a support back-office agent. Be precise and terse.'
  }
  async models(): Promise<IMindsetModels> {
    return { llm: [{ provider: 'openrouter', model: 'google/gemini-3-flash-preview' }] }
  }
}
```

`IAgent` has exactly `instructions()` and `models()`. Implement the interface — do **not** `extends Agent` (`Agent` is a throw-everything DI token, like `Mindset`). `models()` reuses `IMindsetModels` / the model kinds from `wabot-mindset` (agents use the `llm` kind). `@agent()` applies `@injectable()` for you — do not stack `@singleton()`.

## Use an agent — `AgentFactory` + `AgentSession`

Inject `AgentFactory` anywhere (REST/socket/cron handler, a `@tools` method, a service). It needs a registered chat adapter, which the project runner configures automatically from provider API-key env vars.

```typescript
import { AgentFactory } from '@wabot-dev/framework'

class Triage {
  @isIn(['low', 'high'])
  @description('Case severity')
  severity!: string
}

@restController('/support')
export class SupportController {
  constructor(private agents: AgentFactory) {}

  @onPost('/triage')
  async triage() {
    const session = this.agents.for(SupportAgent).session('Working on ticket 42.')

    // typed, validated answer
    const t = await session.ask('How severe is account 42 right now?', Triage)
    t.severity // 'low' | 'high'

    // easy yes/no
    const overdue = await session.confirm('Is account 42 overdue?')

    // order: may return a typed result, a question back, or a budget stop
    const reply = await session.order('Escalate the ticket if overdue.', Triage)
    if (reply.type === 'answer') return reply.value
    if (reply.type === 'question') return { needsInput: reply.text }
    return { stopped: reply.reason } // 'budget' | 'maxSteps'
  }
}
```

The session is a **stateful, in-memory conversation**: each `ask` / `confirm` / `order` sees the previous turns. It is never written to a `ChatMemory`.

### Structured / deterministic output

`ask<T>(question, ResponseClass)` returns a **validated instance** of `ResponseClass` — the same validated request-class pattern used for tool args (`@description` + validators, see `wabot-validation`). Under the hood the agent must fill a synthetic final-answer tool built from your schema, so the result always matches the type. `confirm(question)` is the boolean shortcut.

`order<T>(command, schema?)` returns the full `AgentReply<T>` union:

| `reply.type` | Meaning |
| --- | --- |
| `answer` | `reply.value` is the result (`T` when a schema was given, else the final text). |
| `question` | The agent replied with prose instead of the structured answer — e.g. it needs clarification. `reply.text` holds it. |
| `stopped` | Hit a limit before finishing. `reply.reason` is `'budget'` or `'maxSteps'`. |

`ask` and `confirm` are happy-path sugar: they return the value directly and **throw `AgentPausedError`** if the reply was `question` or `stopped`. Use `order` when you want to branch on those cases.

### Context attachments — "should the bot respond?"

Attach conversations/data as **read-only material** the agent reasons about (never merged into its own turns):

```typescript
const shouldRespond = await this.agents.for(GateAgent).session()
  .attachChat(memory, { lastItems: 20 })   // a ChatMemory (fetched lazily) or an IChatItem[]
  .attachMessage(incoming)                 // the current message under evaluation
  .confirm('Should the bot respond to the latest message? ' +
           'Answer false if it is spam, already handled, or not addressed to the bot.')
```

`attach(text)` / `attachChat(source, { lastItems? })` / `attachMessage(msg)` all return the session for chaining.

## Mindset → agent delegation (controlled context)

Let a mindset reach an agent by calling it from one of the mindset's `@tools`. Build the agent through the fluent builder to get four guarantees:

```typescript
@tools()
export class EscalationTools {
  constructor(private agents: AgentFactory) {}

  @description('Escalate a hard question to the specialist agent')
  async escalate(req: EscalateRequest) {
    const session = this.agents.for(SpecialistAgent)
      .forMindset()                    // enforce exposeToMindsets:false hiding
      .allowTools([KbSearchTools])     // whitelist — everything else is unreachable
      .withBudget({ maxTokens: 8000 }) // token / step cap
      .session(req.curatedContext)     // input isolation: only what you pass in
    const answer = await session.ask(req.question, AnswerSchema)
    return answer                      // memory hygiene: only this returns to the chat
  }
}
```

- **Input isolation** — the agent sees only the context/attachments you pass; the end-user chat history is never auto-forwarded.
- **Memory hygiene** — the agent's own tool calls/reasoning stay in its ephemeral session; only your return value reaches `ChatMemory`.
- **Token budget** — `withBudget({ maxTokens?, maxSteps? })`; exceeding it yields a `stopped` reply, it never throws into the mindset loop.
- **Tool gating** — `allowTools` / `denyTools` (by tool class or function name) + `forMindset()` (honors `exposeToMindsets: false`). A blocked call returns `TOOL_NOT_ALLOWED` to the model; the tool is unreachable.

The builder also has `.denyTools([...])` and `.withContext(str)` (same as passing context to `.session()`).

## Rules

- Agents are for **code-driven** flows; use a mindset for user-facing chat. Don't build a chatbot as an agent.
- `ask` / `confirm` throw `AgentPausedError` on a non-answer — wrap them, or use `order` and branch on `reply.type`.
- A `@tools` class shared with a mindset should mark privileged methods with `@tools({ exposeToMindsets: false })`, and delegations should still `allowTools` an explicit whitelist. Defense in depth.
- Response schemas follow the tool-arg rules: one class, every field has a type validator AND `@description` (see `wabot-validation`).
- `@agent()` already injects; never add `@singleton()`.

## Testing

There is no dedicated agent harness yet. Test agents with the scripted `MockChatAdapter` from `@wabot-dev/framework/testing`: bind your agent as `Agent` in a child container, register the mock as `ChatAdapter`, resolve `AgentOperator`, and script the turns. To drive `ask` / `confirm`, queue an answer-tool turn — `mock.callTool(ANSWER_TOOL_NAME, { ... })` (import `ANSWER_TOOL_NAME` from the framework). See `wabot-testing` for `MockChatAdapter` and the DI-child-container pattern used by `createChatBotHarness`.
