import { Client } from '@hubspot/api-client'
import { injectable } from '@/core/injection'
import { Logger } from '@/core/logger'
import type { IChatMessageFile } from '@/feature/chat-bot'
import { HubSpotChannelConfig } from './HubSpotChannelConfig'

export interface IHubSpotSendMessageRequest {
  threadId: string
  text?: string
  richText?: string
  files?: IChatMessageFile[]
}

export interface IHubSpotSendMessageResult {
  messageId: string
}

interface IHubSpotFile {
  data: Buffer
  name: string
}

interface IHubSpotConversationsMessage {
  type: 'MESSAGE'
  text?: string
  richText?: string
  attachments?: Array<{ fileId: string }>
}

@injectable()
export class HubSpotSender {
  private client: Client
  private logger = new Logger('wabot:hubspot-sender')

  constructor(config: HubSpotChannelConfig, client?: Client) {
    this.client = client ?? new Client({ accessToken: config.accessToken })
  }

  async sendMessage(req: IHubSpotSendMessageRequest): Promise<IHubSpotSendMessageResult> {
    const fileIds: string[] = []
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploaded = await this.uploadFile(file)
        fileIds.push(uploaded.id)
      }
    }

    const body: IHubSpotConversationsMessage = {
      type: 'MESSAGE',
    }
    if (req.text) body.text = req.text
    if (req.richText) body.richText = req.richText
    if (fileIds.length > 0) {
      body.attachments = fileIds.map((fileId) => ({ fileId }))
    }

    if (!body.text && !body.richText && (!body.attachments || body.attachments.length === 0)) {
      throw new Error('HubSpot sendMessage requires at least text, richText or files')
    }

    const path = `/conversations/v3/conversations/${encodeURIComponent(req.threadId)}/messages`
    const response = await this.client.apiRequest({
      method: 'POST',
      path,
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      defaultJson: false,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      this.logger.error(
        `HubSpot sendMessage failed for thread '${req.threadId}': ${response.status} ${errorBody}`,
      )
      throw new Error(`HubSpot sendMessage failed: ${response.status} ${errorBody}`)
    }

    const data = (await response.json()) as { id?: string }
    if (!data.id) {
      throw new Error('HubSpot sendMessage response did not include an id')
    }

    this.logger.trace(`HubSpot message sent to thread '${req.threadId}' as '${data.id}'`)
    return { messageId: data.id }
  }

  private async uploadFile(file: IChatMessageFile): Promise<{ id: string }> {
    const httpFile = await toHttpFile(file)
    const uploaded = await this.client.files.filesApi.upload({
      data: httpFile.data,
      name: httpFile.name,
    })
    return { id: String(uploaded.id) }
  }
}

async function toHttpFile(file: IChatMessageFile): Promise<IHubSpotFile> {
  const name = file.name ?? file.id
  if (file.base64Url) {
    const data = decodeBase64Url(file.base64Url)
    return { data, name }
  }
  if (file.publicUrl) {
    const res = await fetch(file.publicUrl)
    if (!res.ok) {
      throw new Error(`Failed to download file from publicUrl: ${res.status}`)
    }
    const arrayBuffer = await res.arrayBuffer()
    return { data: Buffer.from(arrayBuffer), name }
  }
  throw new Error('IChatMessageFile has neither base64Url nor publicUrl')
}

function decodeBase64Url(dataUri: string): Buffer {
  const commaIdx = dataUri.indexOf(',')
  const payload = commaIdx >= 0 ? dataUri.slice(commaIdx + 1) : dataUri
  return Buffer.from(payload, 'base64')
}
