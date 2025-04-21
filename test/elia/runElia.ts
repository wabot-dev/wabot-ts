import { runServer } from '@/server/runServer'
import { EliaController } from './EliaController'

// new CmdChatBotInterface(EliaMindset, OpenaiChatBotAdapter, RamChatMemoryRepository).start()

runServer({
  controllers: [EliaController],
})
