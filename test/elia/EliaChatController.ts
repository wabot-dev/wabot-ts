import { chatBot, ChatBot, chatController, cmd, type IReceivedMessage, telegram } from '@'

import { EliaGuardMindset } from './EliaGuardMindset'
import { EliaMindset } from './EliaMindset'
import { whatsapp } from '@/channels'

@chatController()
export class EliaChatController {
  constructor(
    @chatBot(EliaMindset) private eliaBot: ChatBot,
    @chatBot(EliaGuardMindset) private eliaGuardBot: ChatBot,
  ) {}

  @telegram({
    botToken: process.env.TELEGRAM_ELIA_BOT_TOKEN!,
  })
  @cmd()
  @whatsapp({
    number: '15550815054',
  })
  onMessage(context: IReceivedMessage) {
    const isLogin = context.user != null

    const chatBot = isLogin ? this.eliaBot : this.eliaGuardBot
    chatBot.sendMessage(context.message, (response) => {
      context.reply(response)
    })
  }
}
