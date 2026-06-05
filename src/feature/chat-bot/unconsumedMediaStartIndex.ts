import { IChatItem } from './IChatItem'

/**
 * Index of the first item whose media (images/documents) the model has not been
 * shown yet — i.e. right after the last model output, be it a bot message or a
 * function call.
 *
 * A file's binary should only be sent on the model's first exposure to it. Once
 * the model has produced anything in response to a human message (a function
 * call during a tool loop, or a reply), it has already analyzed that message's
 * files; re-sending the bytes on the next call would analyze the same file
 * again. This is the within-turn counterpart of {@link pendingMediaStartIndex}:
 * that one keeps a turn's media "active" for vision-model selection across the
 * whole tool loop, while this one stops re-uploading the bytes after the first
 * call.
 *
 * Returns 0 when the model has not produced any output yet, so a brand-new
 * message keeps its media.
 */
export function unconsumedMediaStartIndex(items: IChatItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const type = items[i].type
    if (type === 'botMessage' || type === 'functionCall') return i + 1
  }
  return 0
}
