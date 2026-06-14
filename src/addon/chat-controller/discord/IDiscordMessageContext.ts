export interface IDiscordMessageContext {
  readonly botUserId: string
  readonly wasBotMentioned: boolean
  readonly wasEveryoneMentioned: boolean
  readonly isDirectMessage: boolean
}

export const DISCORD_MESSAGE_CONTEXT = Symbol.for('wabot:discord-message-context')
