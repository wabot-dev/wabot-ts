import { injectable } from '@/core/injection'
import type { IChatConnection, IChatMessage } from '@/feature/chat-bot'
import { IChannelMessage, type IChatChannel } from '@/feature/chat-controller'
import { SocketServerProvider } from '@/feature/socket'
import type { Server } from 'socket.io'
import { SocketChannelConfig } from './SocketChannelConfig'
import {
  runSocketControllers,
  socketConnection,
  socketController,
  socketEvent,
} from '@/feature/socket-controller'
import { Socket } from 'socket.io'
import { IConstructor } from '@/core/generics'
import { jwtConnectionGuard } from '@/addon/auth'

export interface ISocketChannelReceivedMessage {
  chatId: string
  userId: string
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

    @socketController(this.config.namespace)
    class SocketChannelController {

      @socketEvent('message')
      onMessage(message: ISocketChannelReceivedMessage, socket: Socket) {
        if (!channel.callBack) return

        const trimmedInput = message.text.trim()
        if (!trimmedInput) {
          return
        }

        channel.callBack({
          chatConnection: {
            id: message.chatId,
            chatType: 'PRIVATE',
            channelName: SocketChannel.name,
          },
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
            socket.emit('authInfo', authInfo)
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
