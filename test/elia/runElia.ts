import dotenv from 'dotenv'
dotenv.config()

import { container, IChatBot, MindsetMetadataStore, OpenaiChatBot, RamChatMemory, Type } from '@'

import { EliaMindset } from './EliaMindset'

const eliaContainer = container.createChildContainer()
eliaContainer.register(Type.Container, {useValue: eliaContainer})

eliaContainer.register(Type.IMindset, {
  useClass: EliaMindset,
})

eliaContainer.register(Type.IChatMemory, { useValue: new RamChatMemory() })

eliaContainer.register(Type.IChatBot, {
  useClass: OpenaiChatBot,
})

eliaContainer.register(Type.IOpenaiChatbotConfig, {
  useValue: { model: 'gpt-4o' },
})

const metaStore = eliaContainer.resolve(MindsetMetadataStore)
const mindsetMetadata = metaStore.getMindsetMetadata(EliaMindset)
eliaContainer.register(Type.IMindsetMetadata, {
  useValue: mindsetMetadata,
})

const chatBot = eliaContainer.resolve<IChatBot>(Type.IChatBot)


chatBot.sendMessage(
  {
    type: 'USER_MESSAGE',
    userId: '1',
    content: { sender: { userName: 'Jorge' }, text: 'Hola, crea un evento para el dia 23 de abril del 2025 a las 8 de la mañana, duracion 1 hora, con el titulo levantarse' },
  },
  (message) => {
    console.log('Received message:', message)
  },
)
