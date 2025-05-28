import { SocketChannelConfig } from './SocketChannelConfig'
import { inject, injectable } from '@/injection'
import { ChatResolver, SocketIoApp, UserResolver, type IChatChannel, type IReceivedMessage } from '@/controller'
import type { IChatConnection, IChatMessage, IUserConnection } from '@/core'
import type { Server } from 'socket.io'

export interface ISocketChannelReceivedMessage {
  chatId: string
  userId: string
  senderName: string
  text: string
}

@injectable()
export class SocketChannel implements IChatChannel {
  private callBack: ((message: IReceivedMessage) => void) | null = null

  constructor(
    private config: SocketChannelConfig,
    @inject(SocketIoApp) private server: Server,
    private chatResolver: ChatResolver,
    private userResolver: UserResolver,
  ) {}

  listen(callback: (message: IReceivedMessage) => void): void {
    this.callBack = callback
  }

  connect(): void {
    this.server.on('connection', (socket) => {
      socket.on( this.config.channel , async (message: ISocketChannelReceivedMessage) => {
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

        const chat = await this.chatResolver.resolve(chatConnection)

        const userConnection: IUserConnection = {
          id: message.userId,
          channelName: SocketChannel.name,
        }

        const user = await this.userResolver.resolve(userConnection)

        if (!this.callBack) return

        this.callBack({
          chat,
          user,
          message: {
            chatConnection,
            userConnection,
            text: trimmedInput,
            senderName: message.senderName,
          },
          reply: (message: IChatMessage) => {
            socket.emit(this.config.channel, message)
          },
        })
      })
    })
  }
}
