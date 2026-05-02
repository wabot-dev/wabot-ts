import { IConstructor } from '@/core/generics'
import { injectable } from '@/core/injection'
import { type IChatChannel } from '@/feature/chat-controller'
import { ISocketChannelMessage } from './ISocketChannelMessage'
import { socketChannelName } from './socketChannelName'
import {
  handshakeMiddlewares,
  onSocketEvent,
  runSocketControllers,
  socketController,
} from '@/feature/socket-controller'
import { Socket } from 'socket.io'
import { SocketChannelConfig } from './SocketChannelConfig'
import {
  isArray,
  isModel,
  isNotEmpty,
  isOptional,
  isRecord,
  isString,
} from '@/core/validation'
import { Auth } from '@/core/auth'
import type { IChatMessageDocument, IChatMessageImage } from '@/feature/chat-bot'

export class SocketChannelMessageFile {
  @isString()
  @isNotEmpty()
  id!: string

  @isString()
  @isNotEmpty()
  mimeType!: string

  @isString()
  @isNotEmpty()
  @isOptional()
  name?: string

  @isString()
  @isNotEmpty()
  @isOptional()
  publicUrl?: string

  @isString()
  @isNotEmpty()
  @isOptional()
  base64Url?: string
}

export interface ISocketChannelReceivedMessage {
  chatId: string
  senderName?: string
  text?: string
  metadata?: Record<string, string>
  images?: SocketChannelMessageFile[]
  documents?: SocketChannelMessageFile[]
}

export class SocketChannelReceivedMessage implements ISocketChannelReceivedMessage {
  @isString()
  @isNotEmpty()
  chatId!: string

  @isString()
  @isNotEmpty()
  @isOptional()
  senderName?: string

  @isString()
  @isOptional()
  text?: string

  @isRecord('string', 'string')
  @isOptional()
  metadata?: Record<string, string>

  @isArray()
  @isModel(SocketChannelMessageFile)
  @isOptional()
  images?: SocketChannelMessageFile[]

  @isArray()
  @isModel(SocketChannelMessageFile)
  @isOptional()
  documents?: SocketChannelMessageFile[]
}

function toChatFile(
  file: SocketChannelMessageFile,
): IChatMessageImage | IChatMessageDocument | null {
  if (file.publicUrl) {
    return {
      id: file.id,
      mimeType: file.mimeType,
      name: file.name,
      publicUrl: file.publicUrl,
    }
  }
  if (file.base64Url) {
    return {
      id: file.id,
      mimeType: file.mimeType,
      name: file.name,
      base64Url: file.base64Url,
    }
  }
  return null
}

@injectable()
export class SocketChannel implements IChatChannel {
  static channelName = socketChannelName

  private callBack: ((message: ISocketChannelMessage) => Promise<void>) | null = null
  private controller: IConstructor<any> | null = null

  constructor(private config: SocketChannelConfig) {
    this.configController()
  }

  private configController() {
    const channel = this

    @socketController(channel.config.namespace)
    @handshakeMiddlewares(channel.config.handshakeMidlewares ?? [])
    class SocketChannelController {
      constructor(private auth: Auth<any>) {}

      @onSocketEvent('message')
      async onMessage(message: SocketChannelReceivedMessage, socket: Socket) {
        if (!channel.callBack) return

        const chatConnection = {
          id: message.chatId,
          chatType: 'PRIVATE' as const,
          channelName: SocketChannel.channelName,
        }

        const images = message.images?.map(toChatFile).filter((x): x is IChatMessageImage => !!x)
        const documents = message.documents
          ?.map(toChatFile)
          .filter((x): x is IChatMessageDocument => !!x)

        await channel.callBack({
          channel: socketChannelName,
          chatConnection,
          message: {
            text: message.text,
            senderName: message.senderName,
            metadata: message.metadata,
            images: images && images.length > 0 ? images : undefined,
            documents: documents && documents.length > 0 ? documents : undefined,
          },
          reply: async (message) => {
            socket.emit('message', message)
          },
          injectInstances: [
            [Socket, socket],
            [Auth, this.auth],
          ],
        })
      }
    }
    this.controller = SocketChannelController
  }

  listen(callback: (message: ISocketChannelMessage) => Promise<void>): void {
    this.callBack = callback
  }

  connect(): void {
    if (!this.controller) return
    runSocketControllers([this.controller])
  }

  disconnect(): void {
    this.callBack = null
  }
}
