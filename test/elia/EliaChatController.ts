import { chatBot, ChatBot, chatController, cmd, whatsApp, type IReceivedMessage } from '@'

import { EliaGuardMindset } from './EliaGuardMindset'
import { EliaMindset } from './EliaMindset'

@chatController()
export class EliaChatController {
  constructor(
    @chatBot(EliaMindset) private eliaBot: ChatBot,
    @chatBot(EliaGuardMindset) private eliaGuardBot: ChatBot,
  ) {}

  @cmd()
  //@whatsApp('573134336124')
  onMessage(context: IReceivedMessage) {
    const chatBot = this.eliaBot
    chatBot.sendMessage(context.message, (response) => {
      context.reply(response)
    })
  }
}
