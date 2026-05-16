import * as fs from 'node:fs'
import * as path from 'node:path'

import { injectable } from '@/core/injection'
import { Logger } from '@/core/logger'
import { Random } from '@/core/random'
import { Auth } from '@/core/auth'

import { type IChatChannel } from '@/feature/chat-controller'
import { type IChatConnection, type IChatMessage } from '@/feature/chat-bot'

import { CmdChannelConfig } from './CmdChannelConfig'
import { CmdChannelServer } from './CmdChannelServer'
import { ICmdChannelMessage } from './ICmdChannelMessage'
import { cmdChannelName } from './cmdChannelName'

const fileLogger = new Logger('wabot:cmd-channel')

@injectable()
export class CmdChannel implements IChatChannel {
  static channelName = cmdChannelName

  private chatId: string | undefined = undefined
  private callBack: ((message: ICmdChannelMessage) => Promise<void>) | null = null

  constructor(
    private auth: Auth<any>,
    private server: CmdChannelServer,
    private config: CmdChannelConfig,
  ) {}

  listen(callback: (message: ICmdChannelMessage) => Promise<void>): void {
    this.callBack = callback
  }

  disconnect(): void {
    this.server.unregister(this.config.route)
    this.callBack = null
  }

  connect(): void {
    this.server.register(this.config.route, {
      onMessage: async (text, reply) => {
        if (!this.callBack) return

        this.ensureChatId()
        this.ensureAuthLoaded()

        const chatConnection: IChatConnection = {
          id: this.chatId!,
          chatType: 'PRIVATE',
          channelName: CmdChannel.channelName,
        }

        await this.callBack({
          channel: cmdChannelName,
          chatConnection,
          message: { text },
          reply: async (message: IChatMessage) => {
            reply({
              senderName: message.senderName,
              text: extractDisplayText(message),
            })
            if (this.auth.isAssigned()) {
              writeJsonToFile(this.authInfoPath(), this.auth.require())
            }
          },
          injectInstances: [[Auth, this.auth]],
        })
      },
    })
  }

  private routeSlug(): string {
    return this.config.route.replace(/[^a-zA-Z0-9._-]/g, '_')
  }

  private chatIdPath(): string {
    return path.join('.wabot', 'cmd-channel', this.routeSlug(), 'id.json')
  }

  private authInfoPath(): string {
    return path.join('.wabot', 'cmd-channel', this.routeSlug(), 'auth-info.json')
  }

  private ensureChatId(): void {
    if (this.chatId !== undefined) return
    this.chatId = readJsonFromFile<string>(this.chatIdPath()) ?? undefined
    if (!this.chatId) {
      this.chatId = Random.alphaNumericLowerCase(10)
      writeJsonToFile(this.chatIdPath(), this.chatId)
    }
  }

  private ensureAuthLoaded(): void {
    if (this.auth.isAssigned()) return
    const authInfo = readJsonFromFile(this.authInfoPath())
    if (authInfo) {
      this.auth.assign(authInfo)
    }
  }
}

function extractDisplayText(message: IChatMessage): string {
  const raw = message.text ?? ''
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return raw
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
      return parsed.text
    }
  } catch {
    // not JSON — fall through and return raw
  }
  return raw
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
    fileLogger.warn(`Failed to parse JSON from ${filename}:`, err)
    return null
  }
}
