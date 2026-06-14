import { IDiscordEmbed } from './IDiscordEmbed'

export interface IDiscordOutbound {
  embeds?: IDiscordEmbed[]
  stickerIds?: string[]
}
