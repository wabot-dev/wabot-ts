import { chatBot, ChatBot, chatController, cmd, whatsAppByWasender, type IReceivedMessage } from '@'

import { EliaMindset } from './EliaMindset'

@chatController()
export class EliaChatController {
  constructor(@chatBot(EliaMindset) private eliaBot: ChatBot) {}

  @cmd()
  @whatsAppByWasender()
  onMessage(context: IReceivedMessage) {
    const chatBot = this.eliaBot
    chatBot.sendMessage(context.message, async (response) => {
      await context.reply(response)
    })
  }
}
