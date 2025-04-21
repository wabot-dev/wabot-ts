import {
  OpenaiChatBotAdapter,
  RamChatRepository,
  runChannel,
  TelegramChannel,
  TelegramChannelConfig,
} from '@'
import { EliaMindset } from './EliaMindset'

runChannel({
  channel: TelegramChannel,
  channelConfig: new TelegramChannelConfig(process.env.TELEGRAM_ELIA_BOT_TOKEN!),
  mindset: EliaMindset,
  chatBotAdapter: OpenaiChatBotAdapter,
  chatRepository: RamChatRepository,
})
