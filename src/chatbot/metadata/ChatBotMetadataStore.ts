import { singleton } from "@/injection";
import { IChatBotMetadata } from "./IChatBotMetadata";

@singleton()
export class ChatBotMetadataStore {

  saveChatBotMetadata(chatBot: IChatBotMetadata) {

  }

  getChatBotsMetadata(): IChatBotMetadata[] {
    return []
  }
}