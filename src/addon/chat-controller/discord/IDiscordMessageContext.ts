import { container } from '@/core/injection'

export interface IDiscordMessageContext {
  readonly botUserId: string
  readonly wasBotMentioned: boolean
  readonly wasEveryoneMentioned: boolean
  readonly isDirectMessage: boolean
}

export const DISCORD_MESSAGE_CONTEXT = Symbol.for('wabot:discord-message-context')

// Register a no-op default so multi-channel controllers that declare
// @inject(DISCORD_MESSAGE_CONTEXT) in their constructor resolve cleanly when
// messages arrive from channels other than Discord. The Discord channel
// overrides this with the real per-message value via injectInstances.
const DISCORD_MESSAGE_CONTEXT_DEFAULT: IDiscordMessageContext = {
  botUserId: '',
  wasBotMentioned: false,
  wasEveryoneMentioned: false,
  isDirectMessage: false,
}
if (!container.isRegistered(DISCORD_MESSAGE_CONTEXT)) {
  container.registerInstance(DISCORD_MESSAGE_CONTEXT, DISCORD_MESSAGE_CONTEXT_DEFAULT)
}
