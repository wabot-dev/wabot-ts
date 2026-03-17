import { IReceivedMessage } from "@/feature/chat-controller";
import { IWhatsAppByWasenderChatMessage } from "./IWhatsAppByWasenderChatMessage";
import { whatsAppByWasenderChannelName } from "./whatsAppByWasenderChannelName";

export interface IWhatsAppByWasenderReceivedMessage extends IReceivedMessage {
  channel: typeof whatsAppByWasenderChannelName
  message: IWhatsAppByWasenderChatMessage
}
