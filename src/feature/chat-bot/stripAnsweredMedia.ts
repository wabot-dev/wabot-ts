import { IChatItem } from './IChatItem'
import { pendingMediaStartIndex } from './pendingMediaStartIndex'

export function stripAnsweredMedia(items: IChatItem[]): IChatItem[] {
  const start = pendingMediaStartIndex(items)
  return items.map((item, index) => {
    if (index >= start || item.type !== 'humanMessage') return item
    if (!item.humanMessage.images && !item.humanMessage.documents) return item
    const humanMessage = { ...item.humanMessage }
    delete humanMessage.images
    delete humanMessage.documents
    return { type: 'humanMessage', humanMessage }
  })
}
