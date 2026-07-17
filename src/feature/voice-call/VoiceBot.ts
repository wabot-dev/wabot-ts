import { injectable } from '@/core/injection'
import { MindsetOperator } from '@/feature/mindset'
import { IVoiceCall } from './IIncomingVoiceCall'
import { RealtimeVoiceEngine } from './RealtimeVoiceEngine'
import { RealtimeVoiceSession } from './RealtimeVoiceSession'

export interface IVoiceAnswerOptions {
  /** Instruction for the bot's opening line when the call connects. */
  greeting?: string
  voice?: string
}

/**
 * A voice bot bound to one Mindset — the voice analogue of ChatBot. `@voiceBot`
 * injects one per Mindset into a voice controller; `answer()` bridges the call's
 * media to the realtime engine using that Mindset's prompt + tools.
 */
@injectable()
export class VoiceBot {
  constructor(
    private mindset: MindsetOperator,
    private engine: RealtimeVoiceEngine,
  ) {}

  async answer(call: IVoiceCall, options: IVoiceAnswerOptions = {}): Promise<RealtimeVoiceSession> {
    const instructions = await this.mindset.systemPrompt()
    const tools = this.mindset.tools()
    return RealtimeVoiceSession.start({
      media: call.media,
      engine: this.engine,
      connection: call.connection,
      instructions,
      tools,
      callFunction: (name, args) => this.mindset.callFunction(name, args),
      // Explicit option wins; otherwise use the voice the channel/intent set on
      // the call (`@twilioVoice({ voice })` or an outbound `initiate({ voice })`).
      voice: options.voice ?? call.voice,
      greeting: options.greeting ?? call.greeting,
    })
  }
}
