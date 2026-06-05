import { injectable } from '@/core/injection'
import { Logger } from '@/core/logger'
import { IMindsetModelRef } from '@/feature/mindset'
import { ChatAdapter } from './ChatAdapter'
import { IChatMessage } from './IChatMessage'
import { IChatMessageImage } from './IChatMessageImage'

const DESCRIBE_SYSTEM_PROMPT = `
You describe images so they can be referenced later in a conversation without
seeing the image again.

Write a single, factual, self-contained paragraph covering the visible content:
objects, people, scene, layout, colors, and any readable text. Be thorough but
concise. Do not add opinions, greetings, or markdown — output only the
description.
`.trim()

/**
 * Generates a text description for images so the conversation can recall their
 * content on later turns without re-sending (and re-analyzing) the binary.
 *
 * The description is produced once, on arrival, with a single vision-model call
 * and stored on the image itself; from then on it travels with the message text
 * via {@link extractChatMessageText}.
 */
@injectable()
export class ImageDescriber {
  private logger = new Logger('wabot:image-describer')

  constructor(private adapter: ChatAdapter) {}

  /**
   * Fills `description` for every image on the message that does not have one
   * yet, mutating the images in place. Safe to call with no images or no models:
   * it simply does nothing. Failures are logged and leave the image undescribed
   * rather than aborting the message.
   */
  async describeMessageImages(message: IChatMessage, models: IMindsetModelRef[]): Promise<void> {
    const pending = message.images?.filter((image) => !image.description)
    if (!pending || pending.length === 0 || models.length === 0) return

    await Promise.all(
      pending.map(async (image) => {
        const description = await this.describe(image, models)
        if (description) image.description = description
      }),
    )
  }

  async describe(
    image: IChatMessageImage,
    models: IMindsetModelRef[],
  ): Promise<string | undefined> {
    if (models.length === 0) return undefined
    try {
      const { nextItems } = await this.adapter.nextItems({
        models,
        systemPrompt: DESCRIBE_SYSTEM_PROMPT,
        tools: [],
        prevItems: [
          {
            type: 'humanMessage',
            humanMessage: { text: 'Describe this image.', images: [image] },
          },
        ],
      })

      const parts: string[] = []
      for (const item of nextItems) {
        if (item.type === 'botMessage' && item.botMessage.text) parts.push(item.botMessage.text)
      }
      return parts.join('\n').trim() || undefined
    } catch (err) {
      this.logger.warn(
        `failed to describe image '${image.id}'`,
        err instanceof Error ? { message: err.message } : { err },
      )
      return undefined
    }
  }
}
