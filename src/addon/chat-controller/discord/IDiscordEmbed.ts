export interface IDiscordEmbedField {
  name: string
  value: string
  inline?: boolean
}

export interface IDiscordEmbedAuthor {
  name: string
  url?: string
  iconUrl?: string
}

export interface IDiscordEmbedFooter {
  text: string
  iconUrl?: string
}

export interface IDiscordEmbedImage {
  url: string
}

export interface IDiscordEmbed {
  title?: string
  description?: string
  url?: string
  timestamp?: string
  color?: number
  footer?: IDiscordEmbedFooter
  image?: IDiscordEmbedImage
  thumbnail?: IDiscordEmbedImage
  author?: IDiscordEmbedAuthor
  fields?: IDiscordEmbedField[]
}
