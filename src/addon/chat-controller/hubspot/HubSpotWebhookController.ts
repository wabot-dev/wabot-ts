import { IncomingMessage } from 'node:http'

import { CustomError } from '@/core/error'
import { Logger } from '@/core/logger'
import { onPost } from '@/feature/rest-controller/metadata'

import {
  IHubSpotConversationNewMessageEvent,
  IHubSpotWebhookEvent,
  IHubSpotWebhookEventBatch,
} from './IHubSpotWebhookEvent'
import { IHubSpotMessagePayload } from './IHubSpotMessagePayload'
import { verifyHubSpotSignatureV3 } from './verifyHubSpotSignatureV3'

export type IHubSpotMessageListener = (payload: IHubSpotMessagePayload) => Promise<void>

export interface IHubSpotWebhookControllerDeps {
  webhookSecret: string
  listener: IHubSpotMessageListener
  channelName: string
}

const SIGNATURE_HEADER = 'x-hubspot-signature-v3'
const TIMESTAMP_HEADER = 'x-hubspot-request-timestamp'

export class HubSpotWebhookController {
  private logger: Logger
  private webhookSecret: string
  private listener: IHubSpotMessageListener
  private channelName: string

  constructor(deps: IHubSpotWebhookControllerDeps) {
    this.logger = new Logger(`wabot:hubspot-webhook:${deps.channelName}`)
    this.webhookSecret = deps.webhookSecret
    this.listener = deps.listener
    this.channelName = deps.channelName
  }

  @onPost({ disableJsonParser: true, disableUrlEncodedParser: true })
  async handleWebhook(req: IncomingMessage): Promise<null> {
    const rawBody = await readRawBody(req)
    const signature = headerValue(req, SIGNATURE_HEADER)
    const timestamp = headerValue(req, TIMESTAMP_HEADER)
    const requestUri = req.url ?? '/'

    if (!signature || !timestamp) {
      this.logger.warn('missing signature or timestamp header')
      throw new CustomError({ httpCode: 401, message: 'missing signature headers' })
    }

    const ok = verifyHubSpotSignatureV3({
      secret: this.webhookSecret,
      method: req.method ?? 'POST',
      url: requestUri,
      rawBody,
      timestampHeader: timestamp,
      signatureHeader: signature,
    })

    if (!ok) {
      this.logger.warn(`invalid signature for ${requestUri}`)
      throw new CustomError({ httpCode: 401, message: 'invalid signature' })
    }

    let batch: IHubSpotWebhookEventBatch
    try {
      batch = JSON.parse(rawBody) as IHubSpotWebhookEventBatch
    } catch (err) {
      this.logger.warn(`failed to parse webhook body: ${(err as Error).message}`)
      throw new CustomError({ httpCode: 400, message: 'invalid JSON body' })
    }

    if (!Array.isArray(batch)) {
      throw new CustomError({ httpCode: 400, message: 'expected event batch array' })
    }

    for (const event of batch) {
      await this.dispatch(event)
    }

    return null
  }

  private async dispatch(event: IHubSpotWebhookEvent): Promise<void> {
    if (
      event.subscriptionType !== 'conversation.creation' &&
      event.subscriptionType !== 'conversation.newMessage'
    ) {
      this.logger.warn(`unhandled subscription type: ${event.subscriptionType ?? 'unknown'}`)
      return
    }

    const evt = event as Partial<IHubSpotConversationNewMessageEvent>
    if (!evt.message || evt.message.direction !== 'INCOMING') {
      return
    }

    const msg = evt.message
    const payload: IHubSpotMessagePayload = {
      threadId: msg.threadId ?? evt.objectId ?? '',
      messageId: msg.id,
      senderId: msg.from?.actorId ?? 'unknown',
      senderName: msg.from?.name,
      channel: msg.channel,
      text: msg.text,
      files: [], // MVP: download from HubSpot and inline as base64 in a follow-up
      metadata: {
        subscriptionType: event.subscriptionType,
        portalId: String(evt.portalId ?? ''),
        appId: evt.appId != null ? String(evt.appId) : '',
        channelName: this.channelName,
      },
    }
    await this.listener(payload)
  }
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name]
  if (Array.isArray(value)) return value[0]
  return value
}

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer | string) => {
      data += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    })
    req.on('end', () => resolve(data))
    req.on('error', (err) => reject(err))
  })
}
