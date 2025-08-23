// import { injectable } from '@/injection'

// import { Anthropic } from '@anthropic-ai/sdk'

// import { ChatBotAdapter } from '@/chatbot'
// import type { ChatItem } from '@/core'
// import { MindsetOperator } from '@/mindset'
// import { Logger } from '@/logger'

export class DummyClaudeChatBotAdapter {}

// @injectable()
// export class ClaudeChatBotAdapter extends ChatBotAdapter {
//   private anthropic: Anthropic
//   private model: string
//   private logger = new Logger('wabot:claude-chat-bot-adapter')

//   constructor(mindset: MindsetOperator) {
//     super(mindset)
    
//     const apiKey = process.env.CLAUDE_API_KEY
//     if (!apiKey) {
//       throw new Error(`CLAUDE_API_KEY env variable is required`)
//     }

//     const model = process.env.CLAUDE_CHAT_MODEL
//     if (!model) {
//       throw new Error(`CLAUDE_CHAT_MODEL env variable is required`)
//     }
    
//     this.anthropic = new Anthropic({ apiKey })
//     this.model = model
//   }

//   override async generateNextChatItem(chatItems: ChatItem[]): Promise<ChatItem> {
//     const systemPrompt = await this.systemPrompt()

//     const tools = (await this.mindset.allFunctionsDescriptors()).map((fn) => {
//       return {
//         name: fn.name,
//         description: fn.description,
//         input_schema: {
//           ...fn.parameters,
//           type: 'object' as const
//         }
//       }
//     })

//     const messages = this.mapChatItems(chatItems)

//     const request = {
//       model: this.model,
//       max_tokens: 4096,
//       system: systemPrompt,
//       messages,
//       tools: tools.length > 0 ? tools : undefined,
//     }

//     this.logger.debug(`Call Claude API with Request: ${JSON.stringify(request)}`)

//     const response = await this.anthropic.messages.create(request)

//     let newChatItem: ChatItem

//     const content = response.content[0]
    
//     if (content.type === 'text') {
//       newChatItem = await this.buildBotMessageItem(content.text)
//     } else if (content.type === 'tool_use') {
//       newChatItem = await this.buildFunctionCallItem(
//         content.id,
//         content.name,
//         JSON.stringify(content.input),
//       )
//     } else {
//       throw new Error('Not supported Claude Response')
//     }
    
//     return newChatItem
//   }

//   private mapChatItems(chatItems: ChatItem[]): Anthropic.Messages.MessageParam[] {
//     // const messages: Anthropic.Messages.MessageParam[] = []
    
//     // for (const item of chatItems) {
//     //   const itemData = item.getData()
      
//     //   if (itemData.type === 'CONNECTION_MESSAGE') {
//     //     if (!itemData.content.text) {
//     //       throw new Error('User message content is empty')
//     //     }
//     //     messages.push({ role: 'user', content: itemData.content.text })
//     //   } else if (itemData.type === 'BOT_MESSAGE') {
//     //     if (!itemData.content.text) {
//     //       throw new Error('Assistant message content is empty')
//     //     }
//     //     messages.push({ role: 'assistant', content: itemData.content.text })
//     //   } else if (itemData.type === 'FUNCTION_CALL') {
//     //     messages.push({
//     //       role: 'assistant',
//     //       content: [
//     //         {
//     //           type: 'tool_use',
//     //           id: itemData.content.id,
//     //           name: itemData.content.name,
//     //           input: JSON.parse(itemData.content.arguments || '{}')
//     //         }
//     //       ]
//     //     })
//     //     messages.push({
//     //       role: 'user',
//     //       content: [
//     //         {
//     //           type: 'tool_result',
//     //           tool_use_id: itemData.content.id,
//     //           content: itemData.content.result || 'No result'
//     //         }
//     //       ]
//     //     })
//     //   }
//     // }
    
//     // return messages
//     return []
//   }
// }