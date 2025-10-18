import { IConstructor } from '@/core/generics'
import { injectable } from '@/core/injection'
import { IChannelMessage, type IChatChannel } from '@/feature/chat-controller'
import {
  handshakeMiddlewares,
  onSocketEvent,
  runSocketControllers,
  socketController,
} from '@/feature/socket-controller'
import { Socket } from 'socket.io'
import { SocketChannelConfig } from './SocketChannelConfig'

export interface ISocketChannelReceivedMessage {
  chatId: string
  senderName: string
  text: string
}

@injectable()
export class SocketChannel implements IChatChannel {
  private callBack: ((message: IChannelMessage) => void) | null = null
  private controller: IConstructor<any> | null = null

  constructor(private config: SocketChannelConfig) {
    this.configController()
  }

  private configController() {
    const channel = this

    @socketController(channel.config.namespace)
    @handshakeMiddlewares(channel.config.handshakeMidlewares ?? [])
    class SocketChannelController {
      @onSocketEvent('message')
      onMessage(message: ISocketChannelReceivedMessage, socket: Socket) {
        if (!channel.callBack) return

        const trimmedInput = message.text.trim()
        if (!trimmedInput) {
          return
        }

        const chatConnection = {
          id: message.chatId,
          chatType: 'PRIVATE',
          channelName: SocketChannel.name,
        }

        channel.callBack({
          chatConnection,
          message: {
            text: message.text,
            senderName: message.senderName,
          },
          reply: (message) => {
            socket.emit('message', message)
          },
          authInfo: socket.data.authInfo,
          setAuthInfo: (authInfo) => {
            socket.data.authInfo = authInfo
          },
        })
      }
    }
    this.controller = SocketChannelController
  }

  listen(callback: (message: IChannelMessage) => void): void {
    this.callBack = callback
  }

  connect(): void {
    if (!this.controller) return
    runSocketControllers([this.controller])
  }
}
