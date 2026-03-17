import { IReceivedMessage } from '@/feature/chat-controller'
import { telegramChannelName } from './telegramChannelName'

export interface ITelegramReceivedMessage extends IReceivedMessage {
  channel: typeof telegramChannelName
}
