import { IChatMessage } from './IChatMessage'

export function isChatMessageEmpty(message: IChatMessage): boolean {
  return (
    !message.text && !message.images?.length && !message.documents?.length && !message.object
  )
}
