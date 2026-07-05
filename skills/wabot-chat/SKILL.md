---
name: wabot-chat
description: Use when wiring chat input/output for a Wabot bot — receiving messages from one or more channels (cmd, socket, telegram, whatsapp, wasender), injecting a ChatBot bound to a mindset, and replying. Covers @chatController, @chatBot, @cmd / @socket / @telegram / @whatsApp / @wasender, IReceivedMessage, the ChatBot.sendMessage callback, and the @chatAdapter / runChatAdapters provider model.
---

# Chat controllers, channels, and adapters

A chat controller is the entry point for messages from a transport (terminal, socket, Telegram, WhatsApp). It owns a `ChatBot` bound to one mindset and forwards the message into the bot's processing loop.

## Controller shape

```typescript
import {
  chatBot,
  ChatBot,
  chatController,
  cmd,
  socket,
  telegram,
  whatsApp,
  type IReceivedMessage,
} from '@wabot-dev/framework'
import { PixelMindset } from './mindset/PixelMindset'

@chatController()
export class PixelChatController {
  constructor(@chatBot(PixelMindset) private pixel: ChatBot) {}

  @cmd()
  @socket({ namespace: 'pixel' })
  @telegram({ botToken: process.env.TELEGRAM_BOT_TOKEN! })
  @whatsApp({ number: '+1555…', accessToken: '…', businessNumberId: '…' })
  async onMessage(ctx: IReceivedMessage) {
    await this.pixel.sendMessage(ctx.message, async (reply) => {
      await ctx.reply(reply)
    })
  }
}
```

Channel decorators stack: each one registers the same method on a different transport. The runner instantiates a channel per registration.

`@chatController()` takes no arguments today — `IchatControllerConfig` is currently empty. It applies `@injectable()`.

## `ChatBot` injection

`@chatBot(MindsetCtor)` injects a `ChatBot` instance scoped to that mindset. You can have several in one controller (e.g. a "support" bot and a "sales" bot) — each gets a unique injection token under the hood.

`ChatBot.sendMessage(message, callback)`:
- Persists the incoming message as a `humanMessage` chat item.
- Calls the mindset → adapter loop, executing any tool calls.
- Invokes `callback(replyMessage)` once per `botMessage` item produced.

Inside the loop, the bot picks `models.visionLlm` if any image is attached, otherwise `models.llm`. It will only use providers registered through `@chatAdapter` (see below).

## `IReceivedMessage` and `IChatMessage`

```typescript
interface IReceivedMessage {
  message: IChatMessage
  reply: (message: IChatMessage) => Promise<Record<string, string> | void>
}

interface IChatMessage {
  senderId?: string
  senderName?: string
  text?: string
  images?: IChatMessageImage[]
  documents?: IChatMessageDocument[]
  object?: object
  metadata?: Record<string, string>
}
```

The `reply` callback comes from the channel — for `@cmd` it writes to stdout of the connected `cmd:channel` client; for `@socket` it emits a Socket.IO event; for `@telegram`/`@whatsApp`/`@wasender` it calls the provider's send API. You always pass an `IChatMessage` (with `text`, `images`, or `documents`); never raw strings.

## Channels — what each decorator needs

| Decorator | Config | Notes |
| --- | --- | --- |
| `@cmd()` | none | Local Unix socket terminal client. Run `npm run cmd` to chat. State stored under `.wabot/cmd-channel/<route>/`. |
| `@socket({ namespace })` | `namespace: string \| ConfigReference<string>` | Mounts a Socket.IO namespace. Tag-fn refs (`str\`socket.namespace\``) supported. |
| `@telegram({ botToken })` | `botToken: string \| ConfigReference<string>` | Long-poll Telegram bot. Raw token or `str\`telegram.bot_token\``. |
| `@whatsApp(numberOrConfig)` | string OR `{ number, accessToken?, businessNumberId? }` (each may be a `ConfigReference`) | WhatsApp Cloud API. |
| `@wasender(config?)` | `{ apiKey?, webhookSecret?, phoneNumber?, webhookPath? }` (each may be a `ConfigReference`) | WaSender integration. |

Channel configs that accept `ConfigReference` resolve env vars automatically — use `str\`wasender.apiKey\`` from `@wabot-dev/framework` to point to `WASENDER_APIKEY`.

## Chat resolution

When a message arrives, `ChatResolver` looks up the `Chat` by `IChatConnection` (`{ chatType: 'PRIVATE' | 'GROUP', channelName, id }`). If none exists, a new `Chat` is created under a lock. You never write this resolution code — it's already wired.

Inside a chat handler, these tokens are available in the child container:
- `Chat` — the resolved chat entity
- `ChatMemory` — append/read chat items for this chat
- `ChatOperator` — convenience wrapper (see `wabot-mindset`)
- `Auth` — populated if the channel attached auth (e.g. via `injectInstances`)

## Chat adapters (providers)

Each LLM provider has a `@chatAdapter({ provider: 'name' })` class implementing `IChatAdapter.nextItems`. The framework ships adapters for `openai`, `anthropic`, `google`, `openrouter`, `deepseek`, and `wabot`.

The project runner registers adapters automatically based on env keys (`OPENAI_API_KEY` → OpenAI, etc.). To override, pass `chatAdapters: [...]` to `run({ chatAdapters: [MyAdapter, OpenaiChatAdapter] })`.

To call them manually (outside the runner):

```typescript
import { runChatAdapters, OpenaiChatAdapter } from '@wabot-dev/framework'
runChatAdapters([OpenaiChatAdapter])
```

`runChatAdapters` binds a `UnionChatAdapter` to the `ChatAdapter` token — it dispatches by `IMindsetModelRef.provider`.

To build your own adapter, implement `IChatAdapter`:

```typescript
import { chatAdapter, IChatAdapter, IChatAdapterNextItemsReq, IChatAdapterNextItemsRes, singleton } from '@wabot-dev/framework'

@chatAdapter({ provider: 'my-llm' })
@singleton()
export class MyLlmAdapter implements IChatAdapter {
  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    // map req.systemPrompt + req.prevItems + req.tools to your API, return { nextItems, usage }
    return { nextItems: [], usage: { inputTokens: 0, outputTokens: 0, provider: 'my-llm', model: req.models[0].model } }
  }
}
```

## Rules

- Keep controllers thin — fetch from `ctx.message`, call `bot.sendMessage`, return. Business logic belongs in modules/services.
- Don't pass raw strings to `ctx.reply` — wrap them in `{ text: '...' }`.
- The reply callback is async; await it so the channel actually flushes.
- `@chatBot(Mindset)` is a parameter decorator — it can only appear in a constructor.
- If you add a new chat adapter, its file must be imported during the runner's scan (so the `@chatAdapter` side-effect runs); place it inside `directories`.
- Avoid building a mindset/controller pair when one controller can route between several mindsets with multiple `@chatBot(...)` constructor params.

## Testing

`createChatControllerHarness({ controller })` from `@wabot-dev/framework/testing` drives a `@chatController` end-to-end without a real channel (same per-message container path as production, `@chatBot` included), with a scripted `MockChatAdapter` playing the LLM. Custom `IChatAdapter` implementations should pass `chatAdapterConformanceCases`. See the `wabot-testing` skill.
