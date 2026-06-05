import { MindsetOperator } from '@/feature/mindset'
import { ChatAdapter } from './ChatAdapter'
import { ChatItem } from './ChatItem'
import { ChatMemory } from './ChatMemory'
import { IChatBot } from './IChatBot'
import { IChatMessage } from './IChatMessage'
import { ImageDescriber } from './ImageDescriber'
import { pendingMediaStartIndex } from './pendingMediaStartIndex'
import { injectable } from '@/core/injection'
import { Logger } from '@/core/logger'

const MAX_CONSECUTIVE_INVALID_ARGS = 2

function isInvalidArgsResult(result: string | undefined): boolean {
  if (!result) return false
  return (
    result.startsWith('{"error":"INVALID_ARGUMENTS"') ||
    result.startsWith('{"error":"INVALID_JSON_ARGUMENTS"')
  )
}

@injectable()
export class ChatBot implements IChatBot {
  private logger = new Logger('wabot:chat-bot')

  constructor(
    private memory: ChatMemory,
    private adapter: ChatAdapter,
    private mindset: MindsetOperator,
    private imageDescriber: ImageDescriber,
  ) {}

  public async sendMessage(
    message: IChatMessage,
    callback: (message: IChatMessage) => Promise<void>,
  ) {
    await this.describeImages(message)
    const newChatItem = new ChatItem({
      type: 'humanMessage',
      humanMessage: message,
    })
    await this.memory.create(newChatItem)
    await this.processLoop(callback, 0)
  }

  // Caption incoming images once, before persisting, so later turns can recall
  // them from the stored description instead of re-sending the binary. The
  // mindset's context/skills/limits focus the description on what matters here.
  private async describeImages(message: IChatMessage) {
    if (!message.images?.some((image) => !image.description)) return
    const [models, context, skills, limits] = await Promise.all([
      this.mindset.resolveModels('visionLlm'),
      this.mindset.context(),
      this.mindset.skills(),
      this.mindset.limits(),
    ])
    await this.imageDescriber.describeMessageImages(message, models, { context, skills, limits })
  }

  protected async processLoop(
    callback: (message: IChatMessage) => Promise<void>,
    invalidArgsCount: number,
  ) {
    const prevItems = await this.memory.findLastItems(16)
    if (prevItems.length === 0) {
      return
    }
    const lastChatItem = prevItems[prevItems.length - 1]
    if (lastChatItem.type === 'botMessage') {
      return
    }

    const systemPrompt = await this.mindset.systemPrompt()
    const tools = this.mindset.tools()
    const identity = await this.mindset.identity()

    const prevItemsData = prevItems.map((x) => x.getData())

    // Only media from the pending exchange is actually sent to the model; images
    // in already-answered messages are not, so they must not force a vision model.
    const mediaStart = pendingMediaStartIndex(prevItemsData)
    const needsVision = prevItemsData.some(
      (data, index) =>
        index >= mediaStart &&
        data.type === 'humanMessage' &&
        (data.humanMessage.images?.length ?? 0) > 0,
    )
    const kind = needsVision ? 'visionLlm' : 'llm'
    const candidates = await this.mindset.resolveModels(kind)
    if (candidates.length === 0) {
      throw new Error(
        `Invalid ${this.mindset.constructor.name} - no model resolved for kind '${kind}'`,
      )
    }

    const { nextItems: newItemsData } = await this.adapter.nextItems({
      models: candidates,
      systemPrompt,
      tools,
      prevItems: prevItemsData,
    })

    for (const newItemData of newItemsData) {
      if (newItemData.type === 'functionCall') {
        newItemData.functionCall.result = await this.mindset.callFunction(
          newItemData.functionCall.name,
          newItemData.functionCall.arguments ?? '{}',
        )
        if (isInvalidArgsResult(newItemData.functionCall.result)) {
          invalidArgsCount++
        } else {
          invalidArgsCount = 0
        }
      } else if (newItemData.type === 'botMessage') {
        newItemData.botMessage.senderName = identity.name
      }

      const newChatItem = new ChatItem(newItemData)
      await this.memory.create(newChatItem)

      if (newItemData.type === 'botMessage') {
        await callback(newChatItem.botMessage)
      }
    }

    if (invalidArgsCount >= MAX_CONSECUTIVE_INVALID_ARGS) {
      this.logger.warn(
        `Aborting chat loop after ${invalidArgsCount} consecutive invalid-argument function calls`,
      )
      return
    }

    if (newItemsData.length == 0 || newItemsData[newItemsData.length - 1].type === 'botMessage') {
      return
    }
    await this.processLoop(callback, invalidArgsCount)
  }
}
