import { IReceivedMessage } from "@/feature/chat-controller";
import { IWhatsAppByWasenderChatMessage } from "./IWhatsAppByWasenderChatMessage";

export interface IWhatsAppByWasenderReceivedMessage extends IReceivedMessage {
  message: IWhatsAppByWasenderChatMessage
}
