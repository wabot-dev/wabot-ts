import { Logger } from '@/core/logger'
import type { IChatConnection } from '@/feature/chat-bot'
import { whatsAppChannelName } from '../whatsAppChannelName'
import type {
  IWhatsAppCloudContact,
  IWhatsAppCloudMessage,
  IWhatsAppCloudMessageMetadata,
  IWhatsAppCloudWebhookPayload,
} from './IWhatsAppCloudWebhookPayload'

import { ExpressProvider } from '@/feature/express'
import { json, type Express, type Request, type Response } from 'express'
import {
  IListenWhatsAppMessageRequest,
  IWhatsAppMessageListener,
  WhatsAppReceiver,
} from '../WhatsAppReceiver'
import { WhatsAppRepository } from '../WhatsAppRepository'

export class WhatsAppReceiverByCloudApi extends WhatsAppReceiver {
  private listeners: Map<string, IWhatsAppMessageListener> = new Map()
  private expressApp: Express
  private logger = new Logger('wabot:whatsapp-receiver-by-webhook')

  private webhookPath: string = '/whatsapp/web-hook/:slug'

  constructor(
    private expressProvider: ExpressProvider,
    private whatsAppRepository: WhatsAppRepository,
  ) {
    super()
    this.expressApp = this.expressProvider.getExpress()
  }

  async connect(): Promise<void> {
    this.expressApp.get(this.webhookPath, json(), async (req: Request, res: Response) => {
      try {
        let mode = req.query['hub.mode']
        let token = req.query['hub.verify_token']
        let challenge = req.query['hub.challenge']

        if (!mode || !token || !challenge) {
          res.sendStatus(400)
          return
        }

        const whatsApp = await this.whatsAppRepository.findBySlug(req.params.slug)

        if (!whatsApp || mode !== 'subscribe' || token !== whatsApp.getVerifyToken()) {
          res.sendStatus(403)
          return
        }

        res.status(200).send(challenge)
      } catch (e) {
        this.logger.error('WhatsApp webhook verification failed', e)
        res.sendStatus(500)
        return
      }
    })

    this.expressApp.post(this.webhookPath, json(), (req: Request, res: Response) => {
      const payload = req.body
      this.handlePayload(payload)
      res.sendStatus(200)
    })

    this.expressProvider.listen()
  }

  listenMessage(request: IListenWhatsAppMessageRequest): void {
    this.listeners.set(request.to, request.listener)
  }

  protected async handlePayload(payload: IWhatsAppCloudWebhookPayload) {
    try {
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field !== 'messages' || !change.value.messages || !change.value.contacts) {
            continue
          }
          for (const message of change.value.messages) {
            const contact = change.value.contacts.find((x) => x.wa_id === message.from)
            if (!contact) {
              continue
            }
            await this.emmitMessage(change.value.metadata, message, contact)
          }
        }
      }
    } catch (err) {
      this.logger.error('Failed to handle WhatsApp webhook payload', err)
    }
  }

  private async emmitMessage(
    metadata: IWhatsAppCloudMessageMetadata,
    message: IWhatsAppCloudMessage,
    contact: IWhatsAppCloudContact,
  ) {
    const listener = this.listeners.get(metadata.display_phone_number)
    if (!listener) {
      return
    }
    if (message.type !== 'text') {
      this.logger.warn(`Message type '${message.type}' is not supported yet`)
      return
    }

    const chatConnection: IChatConnection = {
      id: contact.wa_id,
      chatType: 'PRIVATE',
      channelName: whatsAppChannelName,
    }

    await listener({
      chatConnection,
      message: {
        senderName: contact.profile.name,
        text: message.text.body,
      },
    })
  }
}
