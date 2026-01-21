import { IChannelMessage, type IChatChannel } from '@/feature/chat-controller'

import { injectable } from '@/core/injection'

import { type IChatConnection, type IChatMessage } from '@/feature/chat-bot'
import * as readline from 'readline'

import * as fs from 'fs'
import * as path from 'path'
import { Random } from '@/core/random'
import { Auth } from '@/core/auth'

const chatIdPath = '.cmd-channel/id.json'
const authInfoPath = '.cmd-channel/auth-info.json'

@injectable()
export class CmdChannel implements IChatChannel {
  private chatId: string | undefined = undefined

  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  private callBack: ((message: IChannelMessage) => Promise<void>) | null = null

  constructor(private auth: Auth<any>) {}

  listen(callback: (message: IChannelMessage) => Promise<void>): void {
    this.callBack = callback
  }

  connect(): void {
    this.rl.on('line', async (input: string) => {
      const trimmedInput = input.trim()
      if (!trimmedInput) {
        this.rl.prompt()
        return
      }

      if (trimmedInput.toLowerCase() === 'exit') {
        this.rl.close()
        return
      }

      if (this.chatId === undefined) {
        this.chatId = readJsonFromFile(chatIdPath) ?? undefined
        if (!this.chatId) {
          this.chatId = Random.alphaNumericLowerCase(10)
          writeJsonToFile(chatIdPath, this.chatId)
        }
      }

      const chatConnection: IChatConnection = {
        id: this.chatId,
        chatType: 'PRIVATE',
        channelName: CmdChannel.name,
      }

      if (!this.callBack) return

      if (!this.auth.isAssigned()) {
        const authInfo = readJsonFromFile(authInfoPath)
        if (authInfo) {
          this.auth.assign(authInfo)
        }
      }

      await this.callBack({
        chatConnection,
        message: {
          text: trimmedInput,
        },
        reply: async (message: IChatMessage) => {
          console.log(`\n[${message.senderName}]: ${message.text}\n`)
          this.rl.prompt()
          if (this.auth.isAssigned()) {
            writeJsonToFile(authInfoPath, this.auth.require())
          }
        },
        injectInstances: [[Auth, this.auth]],
      })
    })
  }
}

export function writeJsonToFile<T>(filename: string, data: T): void {
  const filePath = path.resolve(process.cwd(), filename)
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export function readJsonFromFile<T>(filename: string): T | null {
  const filePath = path.resolve(process.cwd(), filename)

  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const jsonData = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(jsonData) as T
  } catch (err) {
    return null
  }
}
