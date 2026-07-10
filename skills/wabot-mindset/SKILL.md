---
name: wabot-mindset
description: Use when defining a Wabot bot's personality, tool functions, language/model configuration, or chat-scope state. Covers @mindset, @tools (formerly @mindsetModule), the IMindset interface (context / identity / skills / limits / workflow / models), IMindsetModels and the model kinds (llm, visionLlm, audioLlm, speechToText, textToSpeech, imageGen, embedding), tool functions exposed via @description, agents the mindset can call autonomously via @mindset({ agents }) with per-agent allow/deny tool gating, request validation, and ChatOperator for per-chat associations. For dev-facing agents that reuse the same tools, see wabot-agents.
---

# Mindset

A mindset is the policy + personality layer of a Wabot bot. It produces the system prompt and exposes tool functions to the LLM through its `tools`.

## Mindset class

```typescript
import {
  mindset,
  type IMindset,
  type IMindsetIdentity,
  type IMindsetModels,
} from '@wabot-dev/framework'

@mindset({ tools: [LanguageTools, BacklogTools] })
export class PixelMindset implements IMindset {
  async context(): Promise<string> {
    return 'The player chats with you to manage their videogame backlog.'
  }

  async identity(): Promise<IMindsetIdentity> {
    return {
      name: 'Pixel',
      language: 'english',
      personality: 'Cheerful 8-bit shopkeeper with a hint of sarcasm.',
      // emotions is optional
    }
  }

  async skills(): Promise<string> { return 'List, add, remove, recommend games.' }
  async limits(): Promise<string> { return 'Never invent games the player did not mention.' }
  async workflow(): Promise<string> { return 'Greet → ask language → manage backlog.' }

  async models(): Promise<IMindsetModels> {
    return {
      llm: [
        { provider: 'openrouter', model: 'google/gemini-3-flash-preview' },
        { provider: 'openrouter', model: 'qwen/qwen3.6-flash' },
      ],
    }
  }
}
```

`IMindset` has six methods. `models()` is technically optional in the type but **must** be implemented — the legacy `llms()` is deprecated and the operator throws if neither is present.

`IMindsetIdentity` has exactly these fields: `name`, `language`, `personality?`, `emotions?`. There is no `age`, no `tone`, no `style` — those would be runtime errors.

`@mindset()` applies `@injectable()` for you. Do not stack `@singleton()`.

## Models

`IMindsetModels` keys are model kinds. Each is an ordered array of `{ provider?, model }` candidates; the runtime tries them top-to-bottom on retryable failures.

```typescript
type IMindsetModelKind =
  | 'llm' | 'visionLlm' | 'audioLlm'
  | 'speechToText' | 'textToSpeech'
  | 'imageGen' | 'embedding'
```

Fallback rules:
- `visionLlm` falls back to `llm` if the chat has no images / no vision model is configured.
- `audioLlm` falls back to `llm`.
- Everything else fails fast if you request a kind you didn't configure.

`provider` is matched against registered chat adapters (`openai`, `anthropic`, `google`, `openrouter`, `deepseek`, `wabot`). If you omit it, the registry's default provider is used.

## Tools — tool functions

A tool class is decorated with `@tools()`. Every method decorated with `@description(...)` becomes an LLM tool. Each tool function takes zero or one parameter; if it takes one, it must be a class with validators on every property (see `wabot-validation`). List the classes under `@mindset({ tools: [...] })`.

> **Config key:** use `tools` on `@mindset`. The old key **`modules` is deprecated** (still works — both are merged if set together). The decorator `@mindsetModule` is likewise a deprecated alias of `@tools`. The same `@tools` class can be reused by a dev-facing agent (`wabot-agents`).

> **Tool names must be unique** across a mindset's tools (and its `agents`). Two exposed functions with the same name — whether from two tool classes or an agent tool colliding with a `@tools` method — throw at first use (`DUPLICATE_TOOL_NAME`). Rename the method, or exclude one side (`allow`/`deny` on an agent binding, or a distinct agent `name`).

```typescript
import {
  description, isIn, isNotEmpty, isNumber, isString, max, min, tools,
} from '@wabot-dev/framework'

export class AddGameRequest {
  @isString()
  @isNotEmpty()
  @description('The title of the game to add to the backlog')
  title!: string
}

@tools({ language: 'english' })
export class BacklogTools {
  constructor(private games: GameRepository) {}

  @description("Add a new game to the player's backlog")
  async addToBacklog(req: AddGameRequest) {
    const game = new Game({
      userId: 'player-one',
      title: req.title,
      status: 'backlog',
      hoursPlayed: 0,
      addedAt: Date.now(),
    })
    await this.games.create(game)
    return { id: game.id, title: req.title }
  }
}
```

Return types:
- Strings/numbers/booleans → sent verbatim to the LLM.
- Objects/arrays → JSON-stringified.
- `Response` objects → status + parsed body included.
- Thrown errors → captured and turned into an error string the LLM can read; the bot keeps running.

`@tools({ language })` only affects how the language is announced to the LLM next to the tool. The config also accepts `exposeToMindsets?` (default `true`; set `false` for agent-only tools — see `wabot-agents`). There is no `name` or `description` on this config — the framework does **not** accept those.

## Agents the mindset can call — `agents`

A mindset can also call **agents** (`wabot-agents`) autonomously. List them under `agents` on `@mindset`; each becomes one callable tool (`ask_<agent_slug>`) whose single free-text `input` the model fills. Invoking it runs a **fresh, isolated** agent session and feeds the agent's reply text back into the chat loop.

```ts
@mindset({
  tools: [CatalogTools],
  agents: [
    SlotAdvisorAgent,                                    // defaults
    { agent: RefundAgent, allow: [RefundTools], name: 'ask_refunds' },
  ],
})
```

- A binding is the bare agent class or `{ agent, allow?, deny?, name?, description?, budget? }`.
- **`allow` / `deny`** gate which of the agent's own tools are reachable in this delegation (by tool class or function name) — the control point for "what can this agent do when my mindset calls it". `forMindset` exposure rules are always enforced (an `exposeToMindsets: false` tool stays hidden unless allow-listed).
- **`name`** overrides the tool name (default `ask_<slug>`; must not collide with a `@tools` method name — that throws). **`description`** overrides `@agent({ description })` (one is required, or startup throws).
- **`budget`** overrides the conservative default cap (`maxTokens: 4000, maxSteps: 8`). The agent gets **only** the task text — no chat history is forwarded.

## Chat-scoped state — `ChatOperator`

Inside any service resolved within a chat handler (mindsets, modules) you can inject `ChatOperator` to access the current `Chat` and read/write per-chat associations and memory:

```typescript
import { ChatOperator } from '@wabot-dev/framework'

@tools({ language: 'english' })
export class LanguageModule {
  constructor(private chat: ChatOperator) {}

  @description('Remember which language the player wants to speak')
  async setLanguage(req: SetLanguageRequest) {
    for (const old of this.chat.findAssociations('language')) {
      await this.chat.removeAssociation(old)
    }
    await this.chat.addAssociation({ type: 'language', id: req.language })
    return { language: req.language }
  }
}
```

`ChatOperator` methods: `saveHumanMessage`, `saveBotMessage`, `getConnections`, `addConnection`, `removeConnection`, `hasAssociation(s)`, `findAssociations(type?)`, `addAssociation`, `removeAssociation`.

`Chat` is also directly injectable inside chat scope.

## System prompt

You don't write the system prompt by hand — `MindsetOperator.systemPrompt()` assembles it from `context`, `identity`, `skills`, `limits`, `workflow`. Output is templated for the LLM with section headers (`# System Instructions`, `## Context`, etc.).

`#` characters are stripped from each section's text to avoid breaking the markdown headers. If you want literal hashes in a prompt, you can't.

## Rules

- Implement `models()`, not `llms()`. The latter is deprecated and only kept as fallback.
- Every tool function: at most one parameter, every field of that parameter has a type validator AND `@description`.
- Don't put business logic in `context/skills/limits/workflow` — those return *strings*. Push logic into modules or services.
- Don't decorate the mindset class with `@singleton()` — mindsets are chat-scoped and the runner builds one per chat.
- Refer to validators and `@description` rules in `wabot-validation`.

## Testing

`createChatBotHarness({ mindset })` from `@wabot-dev/framework/testing` runs the real mindset — system prompt, tool loop, argument validation — against a scripted `MockChatAdapter`. `harness.callTool(name, args)` exercises one tool directly, `harness.systemPrompt()`/`tools()` snapshot what the model sees, and `LlmJudge` grades real-model evals. See the `wabot-testing` skill.
