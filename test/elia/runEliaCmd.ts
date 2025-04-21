import { CmdChannel, OpenaiChatBotAdapter, RamChatRepository, runChannel } from '@'
import { EliaMindset } from './EliaMindset'

runChannel({
  channel: CmdChannel,
  mindset: EliaMindset,
  chatBotAdapter: OpenaiChatBotAdapter,
  chatRepository: RamChatRepository,
})
