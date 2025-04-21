import { chatBot, ChatBot, chatController, IMessageContext, telegram } from '@'

import { EliaMindset } from './EliaMindset'

@chatController()
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
