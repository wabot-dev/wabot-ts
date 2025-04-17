import dotenv from 'dotenv'
dotenv.config()

import {
  ChatBot,
  ChatMemory,
  container,
  Mindset,
  OpenaiChatBot,
  OpenaiChatBotConfig,
  RamChatMemory,
} from '@'


import { EliaMindset } from './EliaMindset'

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
