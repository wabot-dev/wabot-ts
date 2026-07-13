---
name: wabot-voice
description: Use when building real-time phone-call bots for Wabot — receiving inbound calls and placing outbound calls over Twilio, bridged to an OpenAI Realtime model, with the same Mindset as the brain. Covers @voiceController, @voiceBot, @twilioVoice (webhook/media routes + X-Twilio-Signature verification), VoiceBot.answer, IVoiceCall, TwilioCallService.initiate + TwilioAccountRegistry (multiple numbers/accounts), InitiateCallTools, the @realtimeVoiceEngine provider model, and how run() auto-boots it. Also the speechToText/textToSpeech chat voice notes.
---

# Voice controllers, channels, and the realtime engine

A voice controller is the entry point for phone calls from a transport (Twilio). It owns one or more `VoiceBot`s (each bound to a mindset) and, when a call connects, answers with the right one. The live call audio is bridged to a realtime speech model, so the same `Mindset` that powers a chat bot also powers the call.

## Controller shape

```typescript
import {
  str,
  twilioVoice,
  VoiceBot,
  voiceBot,
  voiceController,
  type IVoiceCall,
} from '@wabot-dev/framework'
import { PhoneAssistantMindset } from './PhoneAssistantMindset'

@voiceController()
export class VoiceController {
  constructor(@voiceBot(PhoneAssistantMindset) private assistant: VoiceBot) {}

  @twilioVoice({ publicBaseUrl: str`public.base.url` }) // ← resolves PUBLIC_BASE_URL
  async onCall(call: IVoiceCall) {
    // Route here by the dialed number, hour, etc. `call.greeting` carries the
    // outbound intent's opening line; inbound falls back to your own text.
    await this.assistant.answer(call, {
      greeting: call.greeting ?? 'Saluda breve y cálidamente y pregunta en qué puedes ayudar.',
    })
  }
}
```

Inbound needs **no wiring**: `run()` auto-loads the realtime engine (gated by `OPENAI_API_KEY`) and boots every `@voiceController`. `@voiceController()` takes no arguments today and applies `@injectable()`.

## `VoiceBot` injection

`@voiceBot(MindsetCtor)` is a **constructor parameter** decorator injecting a `VoiceBot` scoped to that mindset — the voice analogue of `@chatBot`. Put several in one controller and pick by `call.connection.to` instead of building a controller per mindset.

`VoiceBot.answer(call, options?)`:
- Opens a `RealtimeVoiceSession` bridging `call.media` ⇄ the realtime engine, using the mindset's system prompt and tools.
- `options: { greeting?: string; voice?: string }` — `greeting` is the instruction for the bot's opening line.
- Returns the `RealtimeVoiceSession` (usually you just `await` it).

## `IVoiceCall`

```typescript
interface IVoiceCall {
  connection: IVoiceCallConnection
  media: IVoiceMediaStream
  greeting?: string // opening line from an outbound initiate() intent
}

interface IVoiceCallConnection {
  callId: string //  provider call id (Twilio CallSid)
  from: string //     caller, E.164 (+57…)
  to: string //       callee (the number dialed), E.164
  direction: 'inbound' | 'outbound'
  channelName: string
}
```

`connection.to` is the number the caller dialed — route multiple numbers to different bots with it. You never touch `media` directly; `VoiceBot.answer` owns it.

## Inbound — the `@twilioVoice` channel

```typescript
@twilioVoice({
  publicBaseUrl: str`public.base.url`,          // origin Twilio reaches you on (ngrok/domain)
  webhookPath: '/voice/sales/incoming',         // per-channel route (give each a distinct path)
  mediaPath: '/voice/sales/media',              // per-channel media route (distinct too)
  verifySignature: bool`twilio.verify.signature:false`,
  authToken: str`twilio.auth.token`,            // token for signature checks (else TWILIO_AUTH_TOKEN)
})
```

| Option | Type | Notes |
| --- | --- | --- |
| `publicBaseUrl` | `string \| ConfigReference<string>` | Builds the webhook + `wss://` media URL. |
| `webhookPath` / `mediaPath` | `string \| ConfigReference<string>` | Default `/voice/twilio/incoming` and `/voice/twilio/media`. Give each channel distinct paths if you register more than one. |
| `voice` | `string \| ConfigReference<string>` | Provider voice name. |
| `verifySignature` | `boolean \| ConfigReference<boolean>` | Validate `X-Twilio-Signature`; invalid/missing → 403, no stream. |
| `authToken` | `string \| ConfigReference<string>` | Token used to verify; multi-account routes also try the token of the account owning `To` (see below). |

Config values may be literals or **core config references** (`str`/`bool` from `@wabot-dev/framework`, resolved from env like the chat decorators — `twilio.verify.signature` → `TWILIO_VERIFY_SIGNATURE`, `:` gives the default). Point each Twilio number's Voice webhook (HTTP POST) at the channel's `webhookPath`. One route serves any number of numbers/accounts — Twilio always sends `To`.

## Outbound — `TwilioCallService`

```typescript
import { container, TwilioCallService } from '@wabot-dev/framework'

const { callId } = await container.resolve(TwilioCallService).initiate({
  to: '+57300…',              // normalized to +57 E.164 when no country code
  from: '+15551112222',       // optional caller-ID; must belong to a registered account
  greeting: 'Recuérdale la cita de mañana y despídete.',
  bot: 'PhoneAssistantMindset', // optional: a name or a Mindset class; else the controller decides
})
```

`initiate` just dials — on answer Twilio fetches the same webhook, so the call runs through the media bridge. **Consent / who-may-be-called is the application's policy**; gate it before calling `initiate` (the framework does not).

### Multiple numbers / accounts — `TwilioAccountRegistry`

```typescript
import { container, TwilioAccountRegistry } from '@wabot-dev/framework'

const accounts = container.resolve(TwilioAccountRegistry)
accounts.register({ accountSid: 'AC_sales',   authToken: '…', numbers: ['+15551112222'] })
accounts.register({ accountSid: 'AC_support', authToken: '…', numbers: ['+573001112233', '+573004445566'] })
```

Each outbound call dials with the credentials of the account that owns its `from` (matched format-insensitively). The single env account (`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_NUMBER`) is registered automatically, so `initiate({ to })` with no `from` uses the first registered number.

### AI-initiated calls — `InitiateCallTools`

Add `InitiateCallTools` to a mindset's `tools` to let the bot place a call mid-conversation (tool `iniciarLlamada`). It calls `TwilioCallService.initiate`, so the same consent gate applies.

## The realtime engine (providers)

Engines carry `@realtimeVoiceEngine({ provider: 'name' })` and implement `IRealtimeVoiceEngine`. The framework ships `OpenaiRealtimeVoiceEngine` (`provider: 'openai'`, model `gpt-realtime`, override with `OPENAI_REALTIME_MODEL`), bridging Twilio Media Streams (G.711 μ-law 8 kHz) end to end.

`run()` selects it automatically when `OPENAI_API_KEY` is set. To wire manually (outside the runner):

```typescript
import { runRealtimeVoiceEngines, runVoiceControllers, OpenaiRealtimeVoiceEngine } from '@wabot-dev/framework'
runRealtimeVoiceEngines([OpenaiRealtimeVoiceEngine])
runVoiceControllers([VoiceController])
```

`runRealtimeVoiceEngines` binds a `UnionRealtimeVoiceEngine` dispatching by `provider`.

## Chat voice notes (unrelated to Twilio)

A **chat** mindset that declares `speechToText` / `textToSpeech` in `models()` will transcribe inbound audio messages and reply with synthesized voice — handled by `ChatBot`, with the audio adapters auto-loaded by the runner. This is separate from the phone-call channel above. See `wabot-chat` / `wabot-mindset`.

## Rules

- Keep controllers thin: pick a bot (optionally by `call.connection.to`) and `await bot.answer(call, { greeting })`. Business logic lives in modules/services.
- `@voiceBot(Mindset)` is a parameter decorator — constructors only. Prefer one controller routing between several `@voiceBot(...)` over many controllers.
- Register more than one `@twilioVoice` only with **distinct** `webhookPath` and `mediaPath` (the media WS upgrade keys on `mediaPath`).
- Enable `verifySignature` in production; keep it off for local ngrok dev if you can't reproduce Twilio's signature.
- Consent is yours to enforce — check it before `initiate`, never assume the framework gates calls.
- Multi-instance: outbound per-call greeting routing uses an in-process `OutboundCallIntents`, so dial from one instance or use sticky routing. Inbound has no such constraint.

## Testing

Unit-test outbound by overriding the protected `TwilioCallService.createCall` (no network) and asserting the dialed `to`/`from`/credentials — see `TwilioCallService.unit.test.ts`. `TwilioAccountRegistry` and `isValidTwilioSignature` have focused unit tests. `twilioVoice.integration.test.ts` exercises the real webhook + media bridge and real Twilio/OpenAI, gated by env (`OPENAI_API_KEY`, Twilio creds, `PUBLIC_BASE_URL`). See the `wabot-testing` skill.
