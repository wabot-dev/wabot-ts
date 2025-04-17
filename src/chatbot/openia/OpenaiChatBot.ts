import { inject, injectable, Type } from '@/injection'
import { IMindset } from '@/mindset/IMindset'
import { v4 as uuidv4 } from 'uuid'
import { IChatBot } from '../IChatBot'
import { IChatItem, ISystemMessageItem, IUserMessageItem } from '../IChatItem'

import { IMindsetMetadata } from '@/mindset'
import { OpenAI } from 'openai'
import { IChatMemory } from '../memory/IChatMemory'
import { IOpenaiChatBotConfig } from './IOpenaiChatBotConfig'

@injectable()
export class OpenaiChatBot implements IChatBot {
  private openai = new OpenAI()
  private memory: IChatMemory
  private mindset: IMindset
  private config: IOpenaiChatBotConfig
  private metadata: IMindsetMetadata

  constructor(
    @inject(Type.IChatMemory) memory: any,
    @inject(Type.IMindset) mindset: any,
    @inject(Type.IOpenaiChatbotConfig) config: any,
    @inject(Type.IMindsetMetadata) metadata: any,
  ) {
    this.memory = memory
    this.mindset = mindset
    this.config = config
    this.metadata = metadata
  }

  async sendMessage(message: IUserMessageItem, callback: (message: ISystemMessageItem) => void) {
    const newChatItem = {
      id: uuidv4(),
      createdAt: new Date(),
      ...message,
    }

    await this.memory.saveItem(newChatItem)
    this.processLoop(callback)
  }

  private async processLoop(callback: (message: ISystemMessageItem) => void) {
    const lastChatItems = await this.memory.findLastItems(10)
    if (lastChatItems.length === 0) {
      return
    }
    if (lastChatItems[lastChatItems.length - 1].type === 'BOT_MESSAGE') {
      return
    }

    const tools = await this.tools()
    const system = await this.system()

    const response = await this.openai.responses.create({
      model: this.config.model,
      input: [...system, ...this.mapChatItems(lastChatItems)],
      tools,
    })

    ;(await this.tryHandleTextResponse(response, callback)) ||
      (await this.tryHandleFunctionCallResponse(response, callback)) ||
      (() => {
        throw new Error('No response from OpenAI')
      })()
  }

  private async tryHandleTextResponse(
    response: OpenAI.Responses.Response,
    callback: (message: ISystemMessageItem) => void,
  ) {
    if (!response.output_text) {
      return false
    }
    const userName = (await this.mindset.identity()).name
    const newBotMessage = {
      id: uuidv4(),
      createdAt: new Date(),
      type: 'BOT_MESSAGE',
      content: {
        sender: { userName },
        text: response.output_text,
      },
    } as const
    await this.memory.saveItem(newBotMessage)
    callback(newBotMessage)
    return true
  }

  private async tryHandleFunctionCallResponse(
    response: OpenAI.Responses.Response,
    callback: (message: ISystemMessageItem) => void,
  ) {
    if (
      !response.output ||
      response.output.length === 0 ||
      response.output[0].type !== 'function_call'
    ) {
      return false
    }
    // const functionName = response.output[0].name
    // const functionArguments = JSON.parse(response.output[0].arguments)
    // const functionResult = await this.mindset.callFunction(functionName, functionArguments)

    // const newFunctionCall = {
    //   id: uuidv4(),
    //   createdAt: new Date(),
    //   type: 'FUNCTION_CALL',
    //   content: {
    //     foreignId: response.output[0].call_id,
    //     name: functionName,
    //     arguments: functionArguments,
    //     result: functionResult,
    //   },
    // } as const
    // await this.memory.saveItem(newFunctionCall)
    // this.processLoop(callback)
    return true
  }

  private mapChatItems(chatItems: IChatItem[]): OpenAI.Responses.ResponseInput {
    const openIaInput: OpenAI.Responses.ResponseInput = []
    for (const item of chatItems) {
      if (item.type === 'USER_MESSAGE') {
        if (!item.content.text) {
          throw new Error('System message content is empty')
        }
        openIaInput.push({ role: 'user', content: item.content.text })
      } else if (item.type === 'BOT_MESSAGE') {
        if (!item.content.text) {
          throw new Error('System message content is empty')
        }
        openIaInput.push({ role: 'assistant', content: item.content.text })
      }
      if (item.type === 'FUNCTION_CALL') {
        openIaInput.push({
          type: 'function_call',
          call_id: item.content.foreignId,
          name: item.content.name,
          arguments: JSON.stringify(item.content.arguments),
        })
        openIaInput.push({
          type: 'function_call_output',
          call_id: item.content.foreignId,
          output: item.content.result,
        })
      }
    }
    return openIaInput
  }

  private async system(): Promise<OpenAI.Responses.ResponseInput> {
    const [identity, skills, limits] = await Promise.all([
      this.mindset.identity(),
      this.mindset.skills(),
      this.mindset.limits(),
    ])

    const systemPrompt = `
       # System Instructions
       you should act as a assistant.
       your primary language is ${identity.language}.
       your name is ${identity.name}.
       ${identity.age ? 'you are ' + identity.age + ' years old.' : ''}
       
        ${identity.personality ? '## Personality (on your primary language) \n' + identity.personality.replaceAll('#', ' ') : ''}

        ## Skills (on your primary language)
        ${skills.replaceAll('#', ' ')}

        ## System limitations (on your primary language)
        ${limits.replaceAll('#', ' ')}

        ## Chat memory
        Next you will receive a chat history,
        you should use this information to answer the user.
    `

    return [{ role: 'system', content: systemPrompt }]
  }

  private async tools(): Promise<OpenAI.Responses.Tool[]> {
    debugger
    console.log(this.metadata)
    return []
  }
}
