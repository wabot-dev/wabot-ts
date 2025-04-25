import dotenv from 'dotenv'
dotenv.config()

import {
  ChatBot,
  ChatBotAdapter,
  ChatRepository,
  type IChatBotAdapter,
  type IChatRepository,
} from '@/chatbot'
import { type IChatChannel } from '@/controller'
import { container } from '@/injection'
import { type IMindset } from '@/mindset'
import { type IConstructor } from '@/shared'
import { prepareChatContainer } from './prepareChatContainer'

export interface IrunChannelProps {
  channel: IConstructor<IChatChannel>
  channelConfig?: object
  mindset: IConstructor<IMindset>
  chatRepository: IConstructor<IChatRepository>
  chatBotAdapter: IConstructor<IChatBotAdapter>
}

export function runChannel(props: IrunChannelProps) {
  container.registerSingleton(ChatRepository, props.chatRepository)
  container.register(ChatBotAdapter, { useClass: props.chatBotAdapter })

  if (props.channelConfig) {
    container.register(props.channelConfig.constructor as any, { useValue: props.channelConfig })
  }

  const channel = container.resolve(props.channel)

  channel.listen(async (context) => {
    const channelContainer = await prepareChatContainer(container, { chat: context }, props.mindset)
    const chatBot = channelContainer.resolve(ChatBot)
    chatBot.sendMessage(context.message, (replyMessage) => {
      context.reply(replyMessage)
    })
  })

  channel.connect()
}
