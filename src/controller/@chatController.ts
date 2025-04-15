import { IOpenaiChatBotConfig } from '@/chatbot'
import { IMindset } from '@/mindset'
import { IConstructor } from '@/shared'

export interface IchatControllerConfig {
  chatBot: {
    mindset: IConstructor<IMindset>
    openai?: IOpenaiChatBotConfig
  }
}
