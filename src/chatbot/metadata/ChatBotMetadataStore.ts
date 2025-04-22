import { singleton } from "@/injection";
import { IChatBotMetadata } from "./IChatBotMetadata";

@singleton()
export class ChatBotMetadataStore {
  private chatBots: IChatBotMetadata[] = []

  saveChatBotMetadata(chatBot: IChatBotMetadata) {
    this.chatBots.push(chatBot)
  }

  getChatBotsMetadata(): IChatBotMetadata[] {
    return this.chatBots
  }
}
