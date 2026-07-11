import { singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IMindset } from '@/feature/mindset'

export interface IVoiceBot {
  /** Stable key used to route a call to this bot (e.g. the Mindset class name). */
  name: string
  mindset: IConstructor<IMindset>
  /** Opening-line instruction spoken when the call connects. */
  greeting?: string
  voice?: string
}

/**
 * Maps a bot key to the Mindset (and voice/greeting) that should handle a call.
 * Inbound calls use the default bot; outbound calls select one by name.
 */
@singleton()
export class VoiceBotRegistry {
  private bots = new Map<string, IVoiceBot>()
  private defaultName?: string

  register(bot: IVoiceBot, options?: { default?: boolean }) {
    this.bots.set(bot.name, bot)
    if (options?.default || this.defaultName === undefined) {
      this.defaultName = bot.name
    }
  }

  /** Returns the named bot, or the default bot when no name is given. */
  get(name?: string): IVoiceBot | undefined {
    if (name) return this.bots.get(name)
    return this.defaultName ? this.bots.get(this.defaultName) : undefined
  }

  defaultBotName(): string | undefined {
    return this.defaultName
  }
}
