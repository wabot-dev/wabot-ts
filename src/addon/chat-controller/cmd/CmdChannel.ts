import { IChannelMessage, type IChatChannel } from '@/feature/chat-controller'

import { injectable } from '@/core/injection'

import { type IChatConnection, type IChatMessage } from '@/feature/chat-bot'
import * as readline from 'readline'

import * as fs from 'fs'
import * as path from 'path'

const chatId = 'cmd'

const authInfoPath = '.cmd-channel/auth-info.json'

@injectable()
export class CmdChannel implements IChatChannel {
  private authInfo: any = undefined

  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  private callBack: ((message: IChannelMessage) => void) | null = null

  listen(callback: (message: IChannelMessage) => void): void {
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

      const chatConnection: IChatConnection = {
        id: chatId,
        chatType: 'PRIVATE',
        channelName: CmdChannel.name,
      }

      if (!this.callBack) return

      if (this.authInfo === undefined) {
        this.authInfo = readJsonFromFile(authInfoPath)
      }

      this.callBack({
        chatConnection,
        message: {
          text: trimmedInput,
        },
        reply: (message: IChatMessage) => {
          console.log(`\n[${message.senderName}]: ${message.text}\n`)
          this.rl.prompt()
        },
        authInfo: this.authInfo || undefined,
        setAuthInfo: (authInfo) => {
          this.authInfo = authInfo || null
          writeJsonToFile(authInfoPath, this.authInfo)
        },
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
