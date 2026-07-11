import { randomUUID } from 'node:crypto'
import { singleton } from '@/core/injection'

export interface IOutboundCallIntent {
  /** Bot key (see {@link VoiceBotRegistry}) that should answer this call. */
  bot: string
  greeting?: string
  voice?: string
}

/**
 * One-shot store bridging `initiate()` to the webhook: when a call is dialed we
 * stash the bot/greeting under a token, pass the token through Twilio, and the
 * media stream redeems it once — keeping instructions off the wire.
 */
@singleton()
export class OutboundCallIntents {
  private intents = new Map<string, IOutboundCallIntent>()

  create(intent: IOutboundCallIntent): string {
    const id = randomUUID()
    this.intents.set(id, intent)
    return id
  }

  take(id: string): IOutboundCallIntent | undefined {
    const intent = this.intents.get(id)
    this.intents.delete(id)
    return intent
  }
}
