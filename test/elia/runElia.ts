import dotenv from 'dotenv'
dotenv.config()

import { container, IChatBot, MindsetMetadataStore, OpenaiChatBot, RamChatMemory, Type } from '@'

import { EliaMindset } from './EliaMindset'

container.register(Type.IMindset, {
  useClass: EliaMindset,
})

container.register(Type.IChatMemory, { useValue: new RamChatMemory() })

container.register(Type.IChatBot, {
  useClass: OpenaiChatBot,
})

container.register(Type.IOpenaiChatbotConfig, {
  useValue: { model: 'gpt-4o' },
})

const metaStore = container.resolve(MindsetMetadataStore)
const mindsetMetadata = metaStore.getMindsetMetadata(EliaMindset)
container.register(Type.IMindsetMetadata, {
  useValue: mindsetMetadata,
})

const chatBot = container.resolve<IChatBot>(Type.IChatBot)

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
