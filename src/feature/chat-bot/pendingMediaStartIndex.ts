import { IChatItem } from './IChatItem'

/**
 * Index of the first chat item that belongs to the current, not-yet-answered
 * exchange — i.e. the item right after the last bot message.
 *
 * Image and document binaries should only be sent to the model for human
 * messages at or after this index. Media in earlier human messages has already
 * been answered by the bot, so its analysis is captured in the bot's replies;
 * re-sending the binary would make the model analyze the same files again on
 * every turn (and re-upload them, wasting tokens).
 *
 * The boundary is the last bot message, not the last model output, so media
 * stays attached for every call of a tool loop within the pending exchange. The
 * provider APIs are stateless — each call resends the whole history — so the
 * bytes must travel on every call up to the bot's reply for the model to keep
 * seeing the file while it works through tool calls (prompt caching keeps the
 * re-send cheap). Do not stop at function calls, or the model goes blind to the
 * image right when it composes its post-tool answer.
 *
 * Returns 0 when the bot has not replied yet, so the whole pending exchange
 * keeps its media.
 */
export function pendingMediaStartIndex(items: IChatItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].type === 'botMessage') return i + 1
  }
  return 0
}
