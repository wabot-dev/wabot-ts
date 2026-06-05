import * as fs from 'node:fs'
import * as net from 'node:net'
import * as path from 'node:path'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { cmdChannelSocketPath } from './cmdChannelSocketPath'
import type { CmdClientMessage, CmdServerMessage, ICmdImage } from './cmdWireProtocol'

export interface ICmdIncomingMessage {
  text?: string
  images?: ICmdImage[]
}

export interface ICmdChannelHandlers {
  onMessage: (
    message: ICmdIncomingMessage,
    reply: (response: { senderName?: string; text: string }) => void,
  ) => Promise<void> | void
  onClear?: () => Promise<void> | void
}

const logger = new Logger('wabot:cmd-channel-server')

@singleton()
export class CmdChannelServer {
  private server: net.Server | null = null
  private channels = new Map<string, ICmdChannelHandlers>()
  private client: net.Socket | null = null
  private buffer = ''
  private activeRoute: string | null = null

  register(route: string, handlers: ICmdChannelHandlers): void {
    this.channels.set(route, handlers)
    this.ensureStarted()
  }

  unregister(route: string): void {
    this.channels.delete(route)
    if (this.activeRoute === route) {
      this.activeRoute = null
    }
  }

  private ensureStarted(): void {
    if (this.server) return

    const socketPath = cmdChannelSocketPath()
    if (process.platform !== 'win32') {
      try {
        fs.unlinkSync(socketPath)
      } catch {
        // ignore: socket file did not exist
      }
      fs.mkdirSync(path.dirname(socketPath), { recursive: true })
    }

    this.server = net.createServer((socket) => this.handleConnection(socket))
    this.server.on('error', (err) => logger.error('cmd channel server error', err))
    this.server.listen(socketPath, () => {
      logger.info(`cmd channel server listening at ${socketPath}`)
    })

    process.once('exit', () => this.shutdown())
    process.once('SIGINT', () => {
      this.shutdown()
      process.exit(0)
    })
    process.once('SIGTERM', () => {
      this.shutdown()
      process.exit(0)
    })
  }

  private shutdown(): void {
    if (this.client) {
      this.client.destroy()
      this.client = null
    }
    if (this.server) {
      this.server.close()
      this.server = null
    }
    if (process.platform !== 'win32') {
      try {
        fs.unlinkSync(cmdChannelSocketPath())
      } catch {
        // ignore
      }
    }
  }

  private handleConnection(socket: net.Socket): void {
    if (this.client) {
      this.send(socket, {
        type: 'error',
        message: 'Another cmd client is already connected',
      })
      socket.end()
      return
    }

    this.client = socket
    this.buffer = ''
    this.activeRoute = null

    socket.on('data', (chunk) => this.handleData(chunk.toString()))
    socket.on('close', () => {
      if (this.client === socket) {
        this.client = null
        this.activeRoute = null
        this.buffer = ''
      }
    })
    socket.on('error', (err) => {
      logger.warn('cmd client connection error', err)
      if (this.client === socket) {
        this.client = null
        this.activeRoute = null
      }
    })
  }

  private handleData(data: string): void {
    this.buffer += data
    let idx: number
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, idx)
      this.buffer = this.buffer.slice(idx + 1)
      if (!line) continue
      let msg: CmdClientMessage
      try {
        msg = JSON.parse(line) as CmdClientMessage
      } catch {
        this.sendToClient({ type: 'error', message: 'invalid json' })
        continue
      }
      this.handleMessage(msg).catch((err) => {
        logger.error('cmd channel server error handling message', err)
        this.sendToClient({ type: 'error', message: (err as Error).message })
      })
    }
  }

  private async handleMessage(msg: CmdClientMessage): Promise<void> {
    switch (msg.type) {
      case 'hello':
        this.sendToClient({
          type: 'channels',
          list: Array.from(this.channels.keys()).map((route) => ({ route })),
        })
        return
      case 'select':
        if (!this.channels.has(msg.route)) {
          this.sendToClient({ type: 'error', message: `unknown route: ${msg.route}` })
          return
        }
        this.activeRoute = msg.route
        this.sendToClient({ type: 'selected', route: msg.route })
        return
      case 'message': {
        if (!this.activeRoute) {
          this.sendToClient({ type: 'error', message: 'no channel selected' })
          return
        }
        const handlers = this.channels.get(this.activeRoute)
        if (!handlers) {
          this.sendToClient({ type: 'error', message: 'channel no longer available' })
          this.activeRoute = null
          return
        }
        await handlers.onMessage({ text: msg.text, images: msg.images }, (reply) => {
          this.sendToClient({ type: 'reply', ...reply })
        })
        return
      }
      case 'clear': {
        if (!this.activeRoute) {
          this.sendToClient({ type: 'error', message: 'no channel selected' })
          return
        }
        const handlers = this.channels.get(this.activeRoute)
        if (!handlers) {
          this.sendToClient({ type: 'error', message: 'channel no longer available' })
          this.activeRoute = null
          return
        }
        if (handlers.onClear) {
          await handlers.onClear()
        }
        this.sendToClient({ type: 'cleared', route: this.activeRoute })
        return
      }
    }
  }

  private sendToClient(msg: CmdServerMessage): void {
    if (!this.client) return
    this.send(this.client, msg)
  }

  private send(socket: net.Socket, msg: CmdServerMessage): void {
    socket.write(JSON.stringify(msg) + '\n')
  }
}
