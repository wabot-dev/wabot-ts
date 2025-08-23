import { injectable } from '@/core/injection'
import type { IChatConnection, IChatMessage } from '@/feature/chat-bot'
import { IChannelMessage, type IChatChannel } from '@/feature/chat-controller'
import { SocketServerProvider } from '@/feature/socket'
import type { Server } from 'socket.io'
import { SocketChannelConfig } from './SocketChannelConfig'

export interface ISocketChannelReceivedMessage {
  chatId: string
  userId: string
  senderName: string
  text: string
}

@injectable()
export class SocketChannel implements IChatChannel {
  private callBack: ((message: IChannelMessage) => void) | null = null
  private server: Server

  constructor(
    private config: SocketChannelConfig,
    private socketServerProvider: SocketServerProvider,
  ) {
    this.server = this.socketServerProvider.getSocketServer()
  }

  listen(callback: (message: IChannelMessage) => void): void {
    this.callBack = callback
  }

  connect(): void {
    this.server.on('connection', (socket) => {
      socket.on(this.config.channel, async (message: ISocketChannelReceivedMessage) => {
        const trimmedInput = message.text.trim()
        if (!trimmedInput) {
          return
        }

        if (!message.chatId || !message.userId || !message.senderName) {
          socket.emit(this.config.channel, {
            error: 'Invalid message format. chatId, userId, and senderName are required.',
          })
          return
        }

        const chatConnection: IChatConnection = {
          id: message.chatId,
          chatType: 'PRIVATE',
          channelName: SocketChannel.name,
        }

        if (!this.callBack) return

        this.callBack({
          chatConnection,
          message: {
            text: trimmedInput,
            senderName: message.senderName,
          },
          reply: (message: IChatMessage) => {
            socket.emit(this.config.channel, message)
          },
        })
      })
    })

    this.socketServerProvider.listen()
  }
}
