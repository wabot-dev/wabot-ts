import { Logger } from '@/core/logger'
import type { IChatMessageFile } from '@/feature/chat-bot'

import { IHubSpotAttachment } from './IHubSpotWebhookEvent'

export interface IDownloadHubSpotAttachmentsOptions {
  accessToken: string
  logger?: Logger
}

// Inline the HubSpot attachment bytes as `base64Url` data-URIs so downstream
// chat-bot consumers can forward them to LLM providers without HubSpot tokens
// or signed URLs. Mirrors the Telegram strategy in TelegramChannel.downloadChatFile.
export async function downloadHubSpotAttachments(
  attachments: IHubSpotAttachment[] | undefined,
  options: IDownloadHubSpotAttachmentsOptions,
): Promise<IChatMessageFile[]> {
  if (!attachments || attachments.length === 0) return []

  const files: IChatMessageFile[] = []
  for (const attachment of attachments) {
    const file = await downloadOne(attachment, options)
    if (file) files.push(file)
  }
  return files
}

async function downloadOne(
  attachment: IHubSpotAttachment,
  options: IDownloadHubSpotAttachmentsOptions,
): Promise<IChatMessageFile | null> {
  const id = attachment.fileId ?? attachment.id
  const name = attachment.name
  const mimeType = attachment.mimeType ?? 'application/octet-stream'
  if (!attachment.url) {
    options.logger?.warn(`HubSpot attachment '${id}' has no url; skipping`)
    return null
  }

  try {
    const response = await fetch(attachment.url, {
      headers: { Authorization: `Bearer ${options.accessToken}` },
    })
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return {
      id,
      name,
      mimeType,
      base64Url: `data:${mimeType};base64,${base64}`,
    }
  } catch (err) {
    options.logger?.warn(`failed to download HubSpot attachment '${id}': ${(err as Error).message}`)
    return null
  }
}
