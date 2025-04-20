import { IConstructor } from '@/shared'
import { IChatBotAdapter } from '../ChatBotAdapter'
import { IChatMemoryRepository } from '../memory'

export interface IchatBotConfig {
  adapter: IConstructor<IChatBotAdapter>
  memory: IConstructor<IChatMemoryRepository>
}
