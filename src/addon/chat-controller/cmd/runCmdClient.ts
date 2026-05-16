import * as net from 'node:net'
import * as readline from 'node:readline'
import { cmdChannelSocketPath } from './cmdChannelSocketPath'
import type {
  CmdClientMessage,
  CmdServerMessage,
  ICmdChannelEntry,
} from './cmdWireProtocol'

type ClientState = 'disconnected' | 'choosing' | 'chatting'

const useColor =
  process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb'

const ansi = (code: string) => (text: string): string =>
  useColor ? `\x1b[${code}m${text}\x1b[0m` : text

const bold = ansi('1')
const dim = ansi('2')
const cyan = ansi('1;36')
const green = ansi('1;32')
const greenText = ansi('32')
const red = ansi('1;31')
const yellow = ansi('33')

const COMMANDS = ['/channels', '/help', '/exit'] as const

const HELP_LINES = [
  'Commands:',
  '  /channels   list channels and switch',
  '  /help       show this help',
  '  /exit       quit',
]

const RECONNECT_DELAY_MS = 1000

export function runCmdClient(): void {
  const socketPath = cmdChannelSocketPath()

  let socket: net.Socket | null = null
  let buffer = ''
  let routes: ICmdChannelEntry[] = []
  let state: ClientState = 'disconnected'
  let selected: string | null = null
  let reconnectTimer: NodeJS.Timeout | null = null
  let waitingNoticeShown = false
  let exiting = false

  const completer = (line: string): [string[], string] => {
    if (line.startsWith('/')) {
      const hits = COMMANDS.filter((c) => c.startsWith(line))
      return [hits.length > 0 ? hits : [...COMMANDS], line]
    }
    if (state === 'choosing') {
      const hits = routes
        .map((r) => r.route)
        .filter((r) => r.toLowerCase().startsWith(line.toLowerCase()))
      return [hits, line]
    }
    return [[], line]
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
  })

  const send = (msg: CmdClientMessage): boolean => {
    if (!socket || state === 'disconnected') {
      process.stderr.write(
        red('not connected to framework — waiting for server...') + '\n',
      )
      rl.prompt()
      return false
    }
    socket.write(JSON.stringify(msg) + '\n')
    return true
  }

  const printChannels = (list: ICmdChannelEntry[]): void => {
    routes = list
    if (list.length === 0) {
      process.stdout.write(
        yellow('No cmd channels are registered on the server yet.') + '\n',
      )
      rl.prompt()
      return
    }
    process.stdout.write(bold('Available cmd channels:') + '\n')
    list.forEach((entry, i) => {
      const marker = entry.route === selected ? ' ' + yellow('(active)') : ''
      process.stdout.write(`  ${dim(`${i + 1}.`)} ${cyan(entry.route)}${marker}\n`)
    })
    state = 'choosing'
    rl.setPrompt(bold('select # ') + dim('> '))
    rl.prompt()
  }

  const handleServerMessage = (msg: CmdServerMessage): void => {
    switch (msg.type) {
      case 'channels':
        printChannels(msg.list)
        return
      case 'selected':
        selected = msg.route
        state = 'chatting'
        process.stdout.write(green(`[connected to ${msg.route}]`) + '\n')
        rl.setPrompt(cyan(msg.route) + dim(' > '))
        rl.prompt()
        return
      case 'reply':
        process.stdout.write(
          `\n${green(`[${msg.senderName ?? 'bot'}]:`)} ${greenText(msg.text)}\n\n`,
        )
        rl.prompt()
        return
      case 'error':
        process.stderr.write(red('error: ') + red(msg.message) + '\n')
        rl.prompt()
        return
    }
  }

  const scheduleReconnect = (): void => {
    if (exiting || reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, RECONNECT_DELAY_MS)
  }

  const connect = (): void => {
    if (exiting) return

    buffer = ''
    socket = net.connect(socketPath)

    socket.on('connect', () => {
      waitingNoticeShown = false
      process.stdout.write(green('[connected to framework]') + '\n')
      // Try to restore prior selection; otherwise the server will reply with channels.
      if (selected) {
        socket!.write(JSON.stringify({ type: 'select', route: selected }) + '\n')
        state = 'chatting'
        rl.setPrompt(cyan(selected) + dim(' > '))
        rl.prompt()
      } else {
        socket!.write(JSON.stringify({ type: 'hello' }) + '\n')
      }
    })

    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      let idx: number
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 1)
        if (!line) continue
        try {
          handleServerMessage(JSON.parse(line) as CmdServerMessage)
        } catch (err) {
          process.stderr.write(
            red(`invalid server message: ${(err as Error).message}`) + '\n',
          )
        }
      }
    })

    socket.on('error', (err: NodeJS.ErrnoException) => {
      const transient =
        err.code === 'ENOENT' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'ECONNRESET' ||
        err.code === 'EPIPE'
      if (!transient) {
        process.stderr.write(red(`socket error: ${err.message}`) + '\n')
      }
    })

    socket.on('close', () => {
      const wasConnected = state !== 'disconnected'
      state = 'disconnected'
      socket = null
      if (exiting) return
      if (wasConnected) {
        process.stdout.write(
          yellow('\n[disconnected — waiting for framework to come back...]') + '\n',
        )
      } else if (!waitingNoticeShown) {
        waitingNoticeShown = true
        process.stdout.write(dim('Waiting for framework...') + '\n')
      }
      scheduleReconnect()
    })
  }

  const cleanup = (code: number): void => {
    exiting = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    rl.close()
    if (socket) socket.end()
    process.exit(code)
  }

  rl.on('line', (input) => {
    const trimmed = input.trim()
    if (!trimmed) {
      rl.prompt()
      return
    }

    if (trimmed === '/exit' || trimmed.toLowerCase() === 'exit') {
      cleanup(0)
      return
    }
    if (trimmed === '/help') {
      process.stdout.write(HELP_LINES.join('\n') + '\n')
      rl.prompt()
      return
    }
    if (trimmed === '/channels') {
      send({ type: 'hello' })
      return
    }

    if (state === 'disconnected') {
      process.stderr.write(red('not connected to framework — waiting for server...') + '\n')
      rl.prompt()
      return
    }

    if (state === 'choosing') {
      const num = Number.parseInt(trimmed, 10)
      if (!Number.isInteger(num) || num < 1 || num > routes.length) {
        process.stderr.write(
          red(`Invalid selection. Enter a number between 1 and ${routes.length}.`) + '\n',
        )
        rl.prompt()
        return
      }
      send({ type: 'select', route: routes[num - 1].route })
      return
    }

    send({ type: 'message', text: trimmed })
  })

  rl.on('close', () => cleanup(0))

  connect()
}
