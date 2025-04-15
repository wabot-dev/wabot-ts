import { IOpenaiChatBotConfig } from './IOpenaiChatBotConfig'

export class OpenaiChatBotConfig implements IOpenaiChatBotConfig {
  constructor(public readonly model: string) {}
}
