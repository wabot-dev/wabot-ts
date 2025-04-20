import {
  chatBot,
  ChatBot,
  chatController,
  OpenaiChatBotAdapter,
  RamChatMemoryRepository,
  telegram,
} from '@'
import { IMessageContext } from '@/channel/IMessageContext'
import { EliaMindset } from './EliaMindset'

@chatController({
  chatBot: {
    adapter: OpenaiChatBotAdapter,
    memory: RamChatMemoryRepository,
  },
})
export class EliaController {
  constructor(@chatBot(EliaMindset) private eliaBot: ChatBot) {}

  @telegram({
    botToken: process.env.TELEGRAM_ELIA_BOT_TOKEN!,
  })
  onMessage(context: IMessageContext) {
    this.eliaBot.sendMessage(context.message, (response) => {
      context.reply(response)
    })
  }
}
