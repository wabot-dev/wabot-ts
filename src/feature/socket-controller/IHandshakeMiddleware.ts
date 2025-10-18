import { DependencyContainer } from '@/core/injection'
import { Socket } from 'socket.io'

export interface IHandshakeMiddleware {
  handle(socket: Socket, container: DependencyContainer): Promise<void>
}
