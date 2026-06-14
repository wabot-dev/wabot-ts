import {
  chatBot,
  ChatBot,
  chatController,
  cmd,
  discord,
  Logger,
  type IDiscordReceivedMessage,
  hubspot,
  type IChatMessageFile,
  type IHubSpotChannelMessage,
  type IWasenderReceivedMessage,
  wasender,
} from '@'
import { type IDiscordMessageContext, shouldRespondToMention, shouldRespondToTrigger } from '@'

import { EliaMindset } from './EliaMindset'

// 1x1 transparent PNG used as a deterministic test attachment for the
// HubSpot real-sandbox verification. Decoded bytes are 67 bytes — the
// smallest valid PNG.
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

function testPngFile(): IChatMessageFile {
  return {
    id: 'elia-test-png',
    name: 'elia.png',
    mimeType: 'image/png',
    base64Url: `data:image/png;base64,${TEST_PNG_BASE64}`,
  }
}

@chatController()
export class EliaChatController {
  private logger = new Logger('wabot:elia-controller')

  constructor(@chatBot(EliaMindset) private eliaBot: ChatBot) {}

  // @wasender()
  // async onWhatsAppMessage(context: IWasenderReceivedMessage) {
  //   const whatsAppNumber = context.message.metadata.whatsAppNumber
  //   await this.eliaBot.sendMessage(context.message, async (response) => {
  //     await context.reply(response)
  //   })
  // }

  @cmd()
  async onCmdMessage(context: IWasenderReceivedMessage) {
    await this.eliaBot.sendMessage(context.message, async (response) => {
      await context.reply(response)
    })
  }

  // Real-sandbox verification handler for the HubSpot channel. Deterministic
  // (no LLM roundtrip) so the verification script can assert exact text and
  // richText. See test/elia/README.md.
  @hubspot({
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN ?? '',
    webhookSecret: process.env.HUBSPOT_WEBHOOK_SECRET ?? '',
    webhookPath: '/hubspot/webhook/elia',
    senderActorId: process.env.HUBSPOT_SENDER_ACTOR_ID,
  })
  async onHubSpotMessage(context: IHubSpotChannelMessage) {
    const msg = context.message
    const fileCount = msg.images?.length ?? 0
    const text = msg.text
    const trimmed = (text ?? '').trim()
    const wantsAttachment = /^mandame\s+(un|el)\s+archivo/i.test(trimmed)
    const echo = text
      ? `**Hola ${msg.senderName ?? msg.senderId}**, dijiste: ${text}` +
        (fileCount > 0 ? ` (con ${fileCount} adjunto${fileCount > 1 ? 's' : ''})` : '')
      : 'recibido'

    const reply = wantsAttachment ? { text: echo, images: [testPngFile()] } : { text: echo }

    await context.reply(reply)
  }

  @discord()
  async onDiscordMessage(context: IDiscordReceivedMessage) {
    const discordCtx = context.extras?.discord as IDiscordMessageContext | undefined
    if (!discordCtx) return

    const respondMention = shouldRespondToMention(discordCtx)
    const respondTrigger = shouldRespondToTrigger(discordCtx, 'elia', context.message.text ?? '')
    this.logger.info(
      `onDiscord decision: isDM=${discordCtx.isDirectMessage} wasMentioned=${discordCtx.wasBotMentioned} wasEveryone=${discordCtx.wasEveryoneMentioned} → mention=${respondMention} trigger=${respondTrigger}`,
    )
    if (!respondMention && !respondTrigger) return

    await this.eliaBot.sendMessage(context.message, async (response) => {
      await context.reply(response)
    })
  }
}