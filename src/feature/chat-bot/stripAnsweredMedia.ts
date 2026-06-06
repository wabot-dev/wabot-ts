import { IChatItem } from './IChatItem'
import { IChatMessage } from './IChatMessage'
import { pendingMediaStartIndex } from './pendingMediaStartIndex'

export function stripAnsweredMedia(items: IChatItem[]): IChatItem[] {
  const start = pendingMediaStartIndex(items)
  return items.map((item, index) => {
    if (index >= start || item.type !== 'humanMessage') return item
    if (!item.humanMessage.images && !item.humanMessage.documents) return item
    const humanMessage = { ...item.humanMessage }
    delete humanMessage.images
    delete humanMessage.documents
    // A media-only message becomes empty once its binaries are stripped, which
    // makes the provider adapters reject it as empty content. Leave a short
    // placeholder so the answered turn stays in the history coherently.
    if (isStrippedMessageEmpty(humanMessage)) {
      humanMessage.text = describeStrippedMedia(item.humanMessage)
    }
    return { type: 'humanMessage', humanMessage }
  })
}

function isStrippedMessageEmpty(message: IChatMessage): boolean {
  return !message.text && !message.object
}

function describeStrippedMedia(message: IChatMessage): string {
  const parts: string[] = []
  const images = message.images?.length ?? 0
  const documents = message.documents?.length ?? 0
  if (images > 0) parts.push(`${images} image${images > 1 ? 's' : ''}`)
  if (documents > 0) parts.push(`${documents} document${documents > 1 ? 's' : ''}`)
  return `[sent ${parts.join(' and ')}]`
}
