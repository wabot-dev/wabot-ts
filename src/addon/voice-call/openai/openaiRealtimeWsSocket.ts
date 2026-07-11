import WebSocket, { RawData } from 'ws'
import { IRealtimeSocket } from './IRealtimeSocket'

export interface IOpenaiRealtimeWsOptions {
  url: string
  headers: Record<string, string>
}

/** Default {@link IRealtimeSocket} backed by the `ws` client (supports headers). */
export function openaiRealtimeWsSocket(options: IOpenaiRealtimeWsOptions): IRealtimeSocket {
  const ws = new WebSocket(options.url, { headers: options.headers })
  return {
    send: (data) => ws.send(data),
    close: () => ws.close(),
    onOpen: (listener) => ws.on('open', listener),
    onMessage: (listener) => ws.on('message', (data: RawData) => listener(data.toString())),
    onClose: (listener) => ws.on('close', () => listener()),
    onError: (listener) => ws.on('error', (error) => listener(error)),
  }
}
