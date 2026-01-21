import { chatBot, ChatBot, chatController, cmd, type IReceivedMessage } from '@'

import { EliaMindset } from './EliaMindset'

@chatController()
export class EliaChatController {
  constructor(@chatBot(EliaMindset) private eliaBot: ChatBot) {}

  @cmd()
  //@whatsApp('573134336124')
  onMessage(context: IReceivedMessage) {
    const chatBot = this.eliaBot
    chatBot.sendMessage(context.message, async (response) => {
      await context.reply(response)
    })
  }
}
