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
import { isNotEmpty, isString } from '@/core/validation'
import { Auth } from '@/core/auth'

export interface ISocketChannelReceivedMessage {
  chatId: string
  senderName: string
  text: string
}

export class SocketChannelReceivedMessage implements ISocketChannelReceivedMessage {
  @isString()
  @isNotEmpty()
  chatId!: string

  @isString()
  @isNotEmpty()
  senderName!: string

  @isString()
  @isNotEmpty()
  text!: string
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

        const trimmedInput = message.text.trim()
        if (!trimmedInput) {
          return
        }

        const chatConnection = {
          id: message.chatId,
          chatType: 'PRIVATE' as const,
          channelName: SocketChannel.channelName,
        }

        await channel.callBack({
          channel: socketChannelName,
          chatConnection,
          message: {
            text: message.text,
            senderName: message.senderName,
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
