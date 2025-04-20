import { IChatBotAdapter, IChatMemoryRepository } from "@/chatbot"
import { IMindset } from "@/mindset"
import { IConstructor } from "@/shared"

export interface IchatControllerConfig {
  chatBot: {
    adapter: IConstructor<IChatBotAdapter>
    memory: IConstructor<IChatMemoryRepository>
  }
}

