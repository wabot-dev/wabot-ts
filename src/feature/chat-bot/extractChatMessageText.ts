import { IChatMessage } from './IChatMessage'

export interface IExtractChatMessageTextOptions {
  supportedImageMimeTypes?: readonly string[]
  supportedDocumentMimeTypes?: readonly string[]
}

export function extractChatMessageText(
  message: IChatMessage,
  options: IExtractChatMessageTextOptions = {},
): string {
  const messageData = {
    senderId: message.senderId,
    senderName: message.senderName,
    text: message.text,
    object: message.object,
    metadata: message.metadata,
    images: message.images?.map((x) => ({
      id: x.id,
      name: x.name,
      mimeType: x.mimeType,
      description: x.description,
      notAnalyzed: isAnalyzed(x.mimeType, options.supportedImageMimeTypes) ? undefined : true,
    })),
    documents: message.documents?.map((x) => ({
      id: x.id,
      name: x.name,
      mimeType: x.mimeType,
      notAnalyzed: isAnalyzed(x.mimeType, options.supportedDocumentMimeTypes) ? undefined : true,
    })),
  }
  return JSON.stringify(messageData)
}

function isAnalyzed(mimeType: string, supported?: readonly string[]): boolean {
  if (supported === undefined) return true
  return supported.includes(mimeType)
}
