import { MindsetOperator } from '@/feature/mindset'
import { ChatAdapter } from './ChatAdapter'
import { ChatItem } from './ChatItem'
import { ChatMemory } from './ChatMemory'
import { IChatBot } from './IChatBot'
import { IChatMessage } from './IChatMessage'
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
  ) {}

  public async sendMessage(
    message: IChatMessage,
    callback: (message: IChatMessage) => Promise<void>,
  ) {
    const newChatItem = new ChatItem({
      type: 'humanMessage',
      humanMessage: message,
    })
    await this.memory.create(newChatItem)
    await this.processLoop(callback, 0)
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
