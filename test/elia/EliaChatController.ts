import { chatBot, ChatBot, chatController, cmd, type IWasenderReceivedMessage, wasender } from '@'

import { EliaMindset } from './EliaMindset'

@chatController()
export class EliaChatController {
  constructor(@chatBot(EliaMindset) private eliaBot: ChatBot) {}

  @wasender()
  @cmd()
  onMessage(context: IWasenderReceivedMessage) {
    const whatsAppNumber = context.message.metadata.whatsAppNumber

    this.eliaBot.sendMessage(context.message, async (response) => {
      await context.reply(response)
    })
  }
}
