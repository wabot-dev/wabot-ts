import { MindsetOperator } from '@/mindset/MindsetOperator'
import { v4 as uuidv4 } from 'uuid'
import { IChatItem } from './IChatItem'

export interface IChatBotAdapter {
  generateNextChatItem(chatItems: IChatItem[]): Promise<IChatItem>
}

export abstract class ChatBotAdapter implements IChatBotAdapter {
  constructor(protected mindset: MindsetOperator) {}

  abstract generateNextChatItem(chatItems: IChatItem[]): Promise<IChatItem>

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
    const functionResult = await this.mindset.callFunction(functionName, functionArguments)
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
}
