import { ChatItem } from '@/core'
import { MindsetOperator } from '@/mindset'

export interface IChatBotAdapter {
  generateNextChatItem(chatItems: ChatItem[]): Promise<ChatItem>
}

export class ChatBotAdapter implements IChatBotAdapter {
  constructor(protected mindset: MindsetOperator) {}

  public generateNextChatItem(chatItems: ChatItem[]): Promise<ChatItem> {
    throw new Error('Not implemented')
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

  protected async buildBotMessageItem(text: string) {
    // const senderName = (await this.mindset.identity()).name
    // const newBotMessage = new ChatItem({
    //   type: 'BOT_MESSAGE',
    //   content: {
    //     senderName,
    //     text,
    //   },
    // })
    // return newBotMessage
    return 0 as any
  }

  protected async buildFunctionCallItem(
    id: string,
    functionName: string,
    functionArguments: string,
  ) {
    // const functionResult = await this.mindset.callFunction(functionName, functionArguments)
    // const newFunctionCall = new ChatItem({
    //   type: 'FUNCTION_CALL',
    //   content: {
    //     id,
    //     name: functionName,
    //     arguments: functionArguments,
    //     result: functionResult,
    //   },
    // })
    // return newFunctionCall
    return 0 as any
  }
}
