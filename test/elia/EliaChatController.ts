import { chatBot, ChatBot, chatController, cmd, whatsAppByWasender } from '@'

import { EliaMindset } from './EliaMindset'
import { type IWhatsAppByWasenderReceivedMessage } from '@/addon/chat-controller/wasender'

@chatController()
export class EliaChatController {
  constructor(@chatBot(EliaMindset) private eliaBot: ChatBot) {}

  @whatsAppByWasender()
  onMessage(context: IWhatsAppByWasenderReceivedMessage) {
    const whatsAppNumber = context.message.metadata.whatsAppNumber

    this.eliaBot.sendMessage(context.message, async (response) => {
      await context.reply(response)
    })
  }
}
