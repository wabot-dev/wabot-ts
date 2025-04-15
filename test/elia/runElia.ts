import dotenv from 'dotenv'
dotenv.config()

import { ChatBot, ChatMemory, Mindset, OpenaiChatBot, RamChatMemory, container } from '../../src'
import { EliaMindset } from './EliaMindset'
import { OpenaiChatBotConfig } from '@/chatbot/openia/OpenaiChatBotConfig'

container.register(Mindset, {
  useClass: EliaMindset,
})

container.register(ChatMemory, { useValue: new RamChatMemory() })

container.register(ChatBot, {
  useClass: OpenaiChatBot,
})

container.register(OpenaiChatBotConfig, {
  useValue: new OpenaiChatBotConfig('gpt-4o'),
})

const chatBot = container.resolve(ChatBot)

chatBot.sendMessage(
  {
    type: 'USER_MESSAGE',
    userId: '1',
    content: { sender: { userName: 'Jorge' }, text: 'Hola, quien eres' },
  },
  (message) => {
    console.log('Received message:', message)
  },
)
