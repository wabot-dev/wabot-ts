import { IChatMessage } from './IChatMessage'

export function extractChatMessageText(message: IChatMessage): string {
  const messageData = {
    senderId: message.senderId,
    senderName: message.senderName,
    text: message.text,
    object: message.object,
    metadata: message.metadata,
    images: message.images?.map((x) => ({ id: x.id, name: x.name })),
  }
  return JSON.stringify(messageData)
}
