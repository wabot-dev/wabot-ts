import {
  chatBot,
  ChatBot,
  chatController,
  cmd,
  type ISlackReceivedMessage,
  slack,
  str,
  // type IWasenderReceivedMessage,
  // wasender,
} from '@'

import { EliaMindset } from './EliaMindset'

@chatController()
export class EliaChatController {
  constructor(@chatBot(EliaMindset) private eliaBot: ChatBot) {}

  @cmd()
  async onCmdMessage(context: ISlackReceivedMessage) {
    await this.eliaBot.sendMessage(context.message, async (response) => {
      await context.reply(response)
    })
  }

  @slack({ appToken: str`SLACK_APP_TOKEN`, botToken: str`SLACK_BOT_TOKEN` })
  async onSlackMessage(context: ISlackReceivedMessage) {
    await this.eliaBot.sendMessage(context.message, async (response) => {
      await context.reply(response)
    })
  }
}
