import type { IChatAdapterNextItemsReq, IChatAdapterNextItemsRes } from '@/feature/chat-bot'
import type { IAudioTranscribeReq } from '@/feature/chat-bot/IAudioTranscriber'

export interface IOpenaiAudioChatAdapter<SystemReminder = unknown> {
  nextItems(req: IOpenaiAudioChatAdapterNextItemsReq<SystemReminder>): Promise<IOpenaiAudioChatAdapterNextItemsRes<SystemReminder>>
}

export interface IOpenaiAudioChatAdapterNextItemsReq<SystemReminder = unknown> extends IChatAdapterNextItemsReq {
  systemReminder?: SystemReminder
  audioRequest?: IAudioTranscribeReq
}

export interface IOpenaiAudioChatAdapterNextItemsRes<SystemReminder = unknown> extends IChatAdapterNextItemsRes {}
