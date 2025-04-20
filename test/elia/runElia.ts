import dotenv from 'dotenv'
dotenv.config()

import { CmdChatBotInterface, OpenaiChatBotAdapter, RamChatMemoryRepository } from '@'
import { EliaMindset } from './EliaMindset'

new CmdChatBotInterface(EliaMindset, OpenaiChatBotAdapter, RamChatMemoryRepository).start()
