import type { IDiscordMessageContext } from './IDiscordMessageContext'

/**
 * Default mention policy for the Discord channel.
 *
 * Returns `true` for direct messages (the dev usually wants the bot to answer
 * in DMs) and for guild messages that explicitly @-mention the bot or
 * @everyone/@here.
 *
 * Channel-agnostic by design: takes only the normalized context produced by
 * DiscordChannel — no discord.js types leak into the controller.
 *
 * @example
 *   if (!shouldRespondToMention(discord)) return
 */
export function shouldRespondToMention(ctx: IDiscordMessageContext): boolean {
  return ctx.isDirectMessage || ctx.wasBotMentioned || ctx.wasEveryoneMentioned
}

/**
 * Word-boundary trigger match (case-insensitive, diacritics-stripped).
 *
 * Returns `true` for DMs (the dev usually wants the bot to answer), and in
 * guilds when the message text contains `trigger` as a whole word after
 * normalization. `eliana` does NOT match a trigger of `elia`.
 *
 * @example
 *   shouldRespondToTrigger(discord, 'elia', 'elia, ¿estás ahí?') // true
 *   shouldRespondToTrigger(discord, 'elia', 'la eliana, no elia') // true
 *   shouldRespondToTrigger(discord, 'elia', 'no, gracias')        // false
 */
export function shouldRespondToTrigger(
  ctx: IDiscordMessageContext,
  trigger: string,
  text: string,
): boolean {
  if (ctx.isDirectMessage) return true
  const t = normalize(trigger)
  if (!t) return false
  const c = normalize(text)
  if (!c) return false
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|\\W)${escaped}(?=\\W|$)`, 'u').test(c)
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
