import { IChatConnection } from '@/feature/chat-bot'
import { IReceivedMessage } from './IReceivedMessage'

export interface IChannelMessage extends IReceivedMessage {
  chatConnection: IChatConnection
  injectInstances?: [any, any][]
  /**
   * Stable id for this inbound delivery (e.g. a provider's message id). When a
   * channel sets it, the controller runner skips duplicate deliveries within
   * `WABOT_IDEMPOTENCY_TTL_SECONDS` — protecting against webhook retries that
   * would otherwise double-process (and double-bill LLM calls).
   */
  idempotencyKey?: string
}
