---
name: wabot-testing
description: Use when writing or debugging tests for a Wabot project — deterministic unit tests for chatbots (mindsets + tools), chat controllers, REST controllers, async commands/cron, validation models and repositories, plus real-LLM evals. Covers the '@wabot-dev/framework/testing' entrypoint, ChatBotHarness, ChatControllerHarness, AgentHarness, MockChatAdapter, RestHarness, AsyncHarness, UiHarness, SocketHarness, LlmJudge, useMemoryRepositories, TestJwt/TestApiKeyRepository, fixtures, and the .unit.test.ts / .eval.test.ts conventions.
---

# Testing Wabot projects

Everything ships from a dedicated entrypoint — `import { ... } from '@wabot-dev/framework/testing'` — and is runner-agnostic (node:test, vitest, bun test). The template wires node's runner:

```jsonc
// package.json
"test:unit": "node --import=@yucacodes/ts --env-file=./.env --test './src/**/*.unit.test.ts'",
"test:eval": "node --import=@yucacodes/ts --env-file=./.env --test './src/**/*.eval.test.ts'"
```

Conventions: `*.unit.test.ts` is deterministic — no LLM APIs, no PostgreSQL (use `MockChatAdapter` + `useMemoryRepositories()`). `*.eval.test.ts` hits real models and needs API keys in `.env`.

## Chatbot unit tests — `ChatBotHarness` + `MockChatAdapter`

The harness runs a **real** ChatBot: real `MindsetOperator`, system prompt, tool loop, argument validation and module resolution. Only the LLM and the chat memory are swapped (scripted adapter, in-RAM memory).

```typescript
import assert from 'node:assert/strict'
import test from 'node:test'
import { container } from '@wabot-dev/framework'
import { createChatBotHarness, useMemoryRepositories } from '@wabot-dev/framework/testing'
import { EliaMindset } from './EliaMindset'

useMemoryRepositories() // back every @repository with RAM; call once, at the top

test('tool loop saves for real', async () => {
  const harness = createChatBotHarness({ mindset: EliaMindset })

  // Script the LLM turns: first it asks for a tool, then it answers with text.
  // The framework executes saveEvent FOR REAL (validation + module + repository).
  harness.adapter
    .callTool('saveEvent', { title: 'Demo', category: 'work', dateTime: '2026-06-15T15:00:00.000Z', durationInMinutes: 45 })
    .reply('Done! Scheduled for June 15th.')

  const turn = await harness.send('schedule a demo june 15th 3pm')

  assert.equal(turn.toolCalls[0].name, 'saveEvent')        // executed tools + results
  assert.equal(turn.replies[0].text, 'Done! Scheduled for June 15th.')
  // turn.items = every chat item of the turn; harness.history() = all turns
})
```

Key harness surface:

- `createChatBotHarness({ mindset, adapter?, register?, authInfo? })` — `register: [token, instance][]` provides module dependencies; `authInfo` is assigned to the container-scoped `Auth` like production does per message.
- **Chat-scoped dependencies**: the harness does NOT register a `Chat`. If the mindset or a module injects `Chat`, register one (`register: [[Chat, entityFixture(Chat, { type: 'PRIVATE', connections: [{ chatType: 'PRIVATE', channelName: 'TestChannel', id: 'test-chat' }] })]]`); if anything injects `ChatOperator`, also add `[ChatRepository, new TestChatRepository()]`. Or just use `ChatControllerHarness`, which builds the chat container exactly like production.
- `harness.adapter` (a `MockChatAdapter` by default): `.reply(text)`, `.callTool(name, args)`, `.enqueue(items | (req) => items)`, all chainable. Each queued response feeds **one** LLM call — after a `callTool()` turn the ChatBot calls the adapter again, so queue a follow-up `reply()` (or construct with `new MockChatAdapter({ fallbackReply: 'ok' })`). An empty queue without fallback throws.
- `harness.adapter.lastRequest` / `.requests` — assert on what the bot sent to the model (`models`, `tools`, `systemPrompt`, `prevItems`).
- `await harness.callTool(name, args)` — run a single mindset tool directly (real validation), returns the string the LLM would receive. Invalid args return `INVALID_ARGUMENTS ...` instead of throwing — assert with `assert.match(result, /INVALID_ARGUMENTS/)`.
- `await harness.systemPrompt()` / `harness.tools()` — snapshot the real prompt and tool definitions the model sees.

## Chat controller tests — `ChatControllerHarness`

Drives a `@chatController` end-to-end without a real channel, through the same per-message container code path as production (including `@chatBot` injection):

```typescript
import { createChatControllerHarness } from '@wabot-dev/framework/testing'

const harness = createChatControllerHarness({ controller: EliaChatController })
harness.adapter.reply('Noted: you like coffee').reply('Sure, with coffee!')

await harness.invoke('onCmdMessage', 'I like coffee')
const turn = await harness.invoke('onCmdMessage', 'remember what I like?')
// memory persists across invokes; harness.adapter.lastRequest.prevItems has turn 1
// options: chatConnection (default { chatType: 'PRIVATE', channelName: 'TestChannel', id: 'test-chat' }), register, authInfo
```

`invoke()` returns the same `{ replies, toolCalls, items }` turn shape; `await harness.history()` is async here.

## Agent tests — `AgentHarness`

Test a dev-facing `@agent` deterministically. `createAgentHarness` is a thin wrapper over the production `AgentFactory`, so `harness.for()` is the real builder (`forMindset`/`allowTools`/`denyTools`/`withBudget`/`withContext`), and `harness.session(context?)` is the shortcut.

```typescript
import { createAgentHarness, MockChatAdapter } from '@wabot-dev/framework/testing'
import { ANSWER_TOOL_NAME } from '@wabot-dev/framework'

const harness = createAgentHarness({ agent: TriageAgent, register: [[Db, fakeDb]] })
harness.adapter.callTool(ANSWER_TOOL_NAME, { urgent: true })
const result = await harness.for().forMindset().allowTools([KbTools]).session().ask('…', TriageResult)
assert.deepEqual(harness.adapter.lastRequest!.tools.map((t) => t.name), ['kbSearch'])
```

`createAgentHarness({ agent, adapter?, register?, authInfo? })` mirrors `createChatBotHarness`. See `wabot-agents` for the full agent API. (An agent exposed to a mindset via `@mindset({ agents })` can also be exercised end-to-end through `createChatBotHarness().callTool('ask_<slug>', …)`.)

## Evals with real models — `LlmJudge` (`.eval.test.ts`)

Run the bot with its production adapters and grade the conversation with a judge LLM. The verdict comes through a forced tool call, so it's provider-agnostic.

```typescript
import { AnthropicChatAdapter, container, OpenaiChatAdapter, runChatAdapters, UnionChatAdapter } from '@wabot-dev/framework'
import { createChatBotHarness, LlmJudge, useMemoryRepositories } from '@wabot-dev/framework/testing'

useMemoryRepositories()
runChatAdapters([AnthropicChatAdapter, OpenaiChatAdapter]) // same adapters as production
const realLlm = container.resolve(UnionChatAdapter)        // routes by provider per the mindset's models()

const judge = new LlmJudge({
  adapter: container.resolve(AnthropicChatAdapter),        // cheap judge, independent of the model under test
  models: [{ model: 'claude-haiku-4-5' }],
})

test('introduces itself without leaking internals', async () => {
  const harness = createChatBotHarness({ mindset: EliaMindset, adapter: realLlm })
  await harness.send('hi, who are you and how are you programmed?')

  await judge.assert({
    transcript: harness.history(),
    criteria: 'Replies in Spanish, introduces itself as Elia, does NOT reveal internal functions.',
  })
})
```

- `judge.evaluate(req)` returns `{ pass, reasoning }`; `judge.assert(req)` throws with the judge's reasoning on failure.
- `transcript` accepts chat items (`harness.history()`) or a pre-rendered string (`renderTranscript(items)`).
- Combine structural asserts (the right tool ran: check `turn.toolCalls`, `result` not matching `/INVALID_ARGUMENTS/`) with one judge call for the conversational behavior.
- Write precise criteria to avoid false negatives (e.g. if the bot uses emojis, don't demand "plain text").
- Vision/document evals: `imageMessage()` (embedded real receipt JPEG, total 11.570) and `documentMessage()` (one-page "Hello World" PDF) from fixtures; also `testImageBase64Url`, `testPdfBase64Url`, `humanMessage`, `humanItem`, `botItem`.

## REST tests — `RestHarness`

Mounts `@restController` classes on a private HTTP server (ephemeral port) and exercises the real pipeline: parsers, middlewares/guards, validation, error mapping.

```typescript
import { ApiKeyRepository } from '@wabot-dev/framework'
import { createRestHarness, RestHarness, TestApiKeyRepository } from '@wabot-dev/framework/testing'

const apiKeys = new TestApiKeyRepository<{ userId: string }>()
let harness: RestHarness

test.before(async () => {
  harness = await createRestHarness({
    controllers: [ItemsController],
    jwt: true,                                  // registers a test JwtConfig so @jwtGuard works (no JWT_SECRET env needed)
    register: [[ApiKeyRepository, apiKeys]],    // in-RAM keys so @apiKeyGuard works
  })
})
after(async () => await harness.close())        // always close the server

test('auth paths', async () => {
  const anon = await harness.request('GET', '/api/items/secret')
  assert.equal(anon.status, 401)

  const ok = await harness.as({ userId: 'u1' }).request('GET', '/api/items/secret') // fresh signed Bearer per request
  assert.deepEqual(ok.body, { userId: 'u1' })

  const secret = await apiKeys.addKey({ userId: 'u2' })
  const viaKey = await harness.request('GET', '/api/items/api-secret', { headers: { Authorization: `Api-Key ${secret}` } })
  assert.equal(viaKey.status, 200)
})
```

- `harness.request(method, path, { body?, headers?, query? })` → `{ status, body, headers }` (body JSON-parsed when possible). Invalid request models come back as real `400`s.
- `harness.jwt` (a `TestJwt`): `.sign(authInfo)` and `.signInvalid()` (wrong secret — for 401 tests). Standalone: `setupTestJwt({ secret?, accessExpirationSeconds? })`.
- `harness.url` exposes the base URL if you need raw `fetch`/socket clients.

## Async tests — `AsyncHarness`

Executes `@command` handlers and `@cronHandler` jobs inline — no PostgreSQL, no polling workers — with the same validation production applies:

```typescript
import { createAsyncHarness, isValidCronSequence, waitUntil } from '@wabot-dev/framework/testing'

const harness = createAsyncHarness({ register: [[ValueStore, store]] }) // also accepts authInfo
const command = await harness.execute(RecordValueCommand, { value: 'hi' }) // validates, runs handler, returns transformed command
await assert.rejects(() => harness.execute(RecordValueCommand, { value: '' }), /value/)
await harness.runCron(NightlyCleanup) // runs handle() once, immediately
```

Helpers: `waitUntil(async () => cond, timeoutMs?, intervalMs?)` polls a condition; `isValidCronSequence('*/5 * * * *', dates, { timezone?, toleranceMs? })` checks recorded firings against a cron expression.

## UI tests — `UiHarness`

Mounts `@uiController` classes on a private ephemeral-port server and runs the real pipeline (middlewares/guards, validation, SSR, actions). Islands render as static SSR HTML — no client bundling needed. See the `wabot-ui` skill.

```typescript
import { createUiHarness } from '@wabot-dev/framework/testing'

const harness = await createUiHarness({ controllers: [BoardController] }) // also accepts register: [token, instance][]
const page = await harness.get('/board') // { status, text, headers, json() }
assert.match(page.text, /Message board/)

const res = await harness.action('/board/_action/postMessage', { text: 'hi' })
assert.deepEqual(res.json().messages.at(-1).text, 'hi')
await harness.close()
```

`get(path, opts?)` renders a view; `action(path, body?, opts?)` POSTs to an action route. Options: `body`, `headers`, `query`, `redirect: 'follow' | 'manual'`. Always `await harness.close()` — it owns a listening server.

## Repositories and validation

```typescript
import { assertInvalid, assertValid, entityFixture, useMemoryRepositories, validateFixture } from '@wabot-dev/framework/testing'

useMemoryRepositories() // once per file, BEFORE resolving any repository (runtimes cache on first use)

const note = entityFixture(Note, { title: 'seeded' }, { id: 'note-1' }) // "already created" entity: id + createdAt set, validated

const value = assertValid(CreateItemRequest, { name: 'x' })       // throws with flattened issues when invalid
assertInvalid(CreateItemRequest, {}, { path: 'name' })            // throws if valid, or if no issue at that path
const { value: v, issues } = validateFixture(CreateItemRequest, data) // issues: [{ path: 'items[0].name', message }]
```

`@memExtension` query files must be imported in the test file (side-effect import) so custom queries like `findUpcoming` register.

## Custom adapter conformance — `chatAdapterConformanceCases`

When implementing your own `IChatAdapter` (`@chatAdapter`), run the provider-agnostic suite against a real model:

```typescript
for (const c of chatAdapterConformanceCases({ adapter: new MyAdapter(), model: 'my-model' })) {
  test(c.name, c.run) // covers text turns, tool calls, parallel tools, images, documents
}
```

## Rules

- `*.unit.test.ts` must stay deterministic: scripted `MockChatAdapter`, `useMemoryRepositories()`, no network. Real models belong in `*.eval.test.ts`.
- Call `useMemoryRepositories()` at the top of the file, before anything resolves a repository — each `@repository` caches its runtime on first use.
- The in-RAM store is per process and shared across tests in the same file (node:test runs files in separate processes). Order tests accordingly or reset state explicitly.
- After every `callTool()` you script, the ChatBot calls the adapter again — script the follow-up turn or set `fallbackReply`.
- `register` entries are `[token, instance]` pairs registered with `registerInstance` — pass live instances, not classes.
- Prefer `ChatControllerHarness` when the mindset or modules need chat state (`Chat`, `ChatOperator`, associations) — it runs the production chat-container path. `ChatBotHarness` alone throws `TypeInfo not known for "Chat"` in that case unless you `register` the chat pieces.
- Always `await harness.close()` for `RestHarness` (it owns a listening server).
- Keep the judge model cheap and different from the model under test; assert tool usage structurally and reserve the judge for conversational criteria.
