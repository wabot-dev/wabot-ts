import { DependencyContainer } from '@/injection'
import { IMindset } from '@/mindset/IMindset'
import { v4 as uuidv4 } from 'uuid'
import { IChatItem, ISystemMessageItem, IUserMessageItem } from './IChatItem'

import {
  IMindsetFunctionMetadata,
  IMindsetFunctionParamMetadata,
  IMindsetMetadata,
} from '@/mindset'
import { IChatBot } from './IChatBot'
import { IChatMemory } from './memory/IChatMemory'

export abstract class ChatBot implements IChatBot {
  constructor(
    private memory: IChatMemory,
    private mindset: IMindset,
    private metadata: IMindsetMetadata,
    private container: DependencyContainer,
  ) {
    this.memory = memory
    this.mindset = mindset
    this.metadata = metadata
    this.container = container
  }

  public async sendMessage(
    message: IUserMessageItem,
    callback: (message: ISystemMessageItem) => void,
  ) {
    const newChatItem = {
      id: uuidv4(),
      createdAt: new Date(),
      ...message,
    }

    await this.memory.saveItem(newChatItem)
    this.processLoop(callback)
  }

  protected async processLoop(callback: (message: ISystemMessageItem) => void) {
    const prevChatItems = await this.memory.findLastItems(10)
    if (prevChatItems.length === 0) {
      return
    }

    const lastChatItem = prevChatItems[prevChatItems.length - 1]
    if (lastChatItem.type === 'BOT_MESSAGE') {
      return
    }

    const newChatItem = await this.generateNextChatItem(prevChatItems)
    await this.memory.saveItem(newChatItem)

    if (newChatItem.type === 'BOT_MESSAGE') {
      callback(newChatItem)
      return
    }

    this.processLoop(callback)
  }

  protected abstract generateNextChatItem(chatItems: IChatItem[]): Promise<IChatItem>

  protected async buildBotMessageItem(text: string) {
    const userName = (await this.mindset.identity()).name
    const newBotMessage = {
      id: uuidv4(),
      createdAt: new Date(),
      type: 'BOT_MESSAGE',
      content: {
        sender: { userName },
        text,
      },
    } as const
    return newBotMessage
  }

  protected async buildFunctionCallItem(
    foreignId: string,
    functionName: string,
    functionArguments: string,
  ) {
    const functionResult = await this.callFunction(functionName, functionArguments)
    const newFunctionCall = {
      id: uuidv4(),
      createdAt: new Date(),
      type: 'FUNCTION_CALL',
      content: {
        foreignId,
        name: functionName,
        arguments: functionArguments,
        result: functionResult,
      },
    } as const
    return newFunctionCall
  }

  protected async systemPrompt(): Promise<string> {
    let [identity, skills, limits] = await Promise.all([
      this.mindset.identity(),
      this.mindset.skills(),
      this.mindset.limits(),
    ])

    const language = identity.language.replaceAll('#', ' ')
    const name = identity.name.replaceAll('#', ' ')
    const age = identity.age ? identity.age.toString().replaceAll('#', ' ') : null
    const personality = identity.personality ? identity.personality.replaceAll('#', ' ') : null

    skills = skills.replaceAll('#', ' ')
    limits = limits.replaceAll('#', ' ')

    const systemPrompt = `
       # System Instructions
       you should act as a assistant.
       your main language is ${language}.
       your name is ${name}.
       ${age ? 'you are ' + age + ' years old.' : ''}
       
        ${personality ? '## Personality (in your main language) \n' + personality : ''}

        ## Skills (in your main language)
        ${skills}

        ## System limitations (in your main language)
        ${limits}

        ## Chat memory
        Next you will receive a chat history,
        you should use this information to answer the user.
    `
    return systemPrompt
  }

  protected async callFunction(name: string, params: string): Promise<string> {
    const fnMetadata = this.metadata.modules
      .map((module) => module.functions)
      .flat()
      .find((fn) => fn.name === name)

    if (!fnMetadata) {
      throw new Error(`Function ${name} not found`)
    }

    const paramsObj = JSON.parse(params)
    const module = this.container.resolve<any>(fnMetadata.moduleConstructor as any)

    try {
      const response = await module[name](paramsObj)
      if (!response) {
        return 'success'
      }
      return response.toString()
    } catch (error) {
      return `Error: ${error}`
    }
  }

  protected async toolsFunctions() {
    return this.metadata.modules
      .map((module) => module.functions.map((fn) => this.toolFunction(fn)))
      .flat()
  }

  protected toolFunction(fn: IMindsetFunctionMetadata) {
    const description = fn.config.description.replaceAll('#', ' ')
    return {
      type: 'function',
      name: fn.name,
      description,
      parameters: {
        type: 'object',
        properties: fn.params.reduce(
          (prev, param) => ({
            ...prev,
            [param.name]: this.toolParam(param),
          }),
          {},
        ),
        required: fn.params.map((param) => param.name),
      },
    } as const
  }

  protected toolParam(param: IMindsetFunctionParamMetadata) {
    const addons: { [key: string]: string } = {
      description: `
      ### description (in your main language)
      ${param.config.description.replaceAll('#', ' ')}
      `,
    }

    const type = (() => {
      if (param.type === Number) return 'number'
      if (param.type === String) return 'string'
      if (param.type === Date) {
        addons.description = `${addons.description}
          ### format: ISO 8681 - YYYY-MM-DDTHH:mm:ssZ
          ${addons.description}
        `
        return 'string'
      }
      debugger
      throw new Error(`Unsupported type`)
    })()

    return {
      type,
      ...addons,
    }
  }
}
