import { DependencyContainer } from '@/core/injection'
import { Socket } from 'socket.io'

export interface IConnectionMiddleware {
  handle(socket: Socket, container: DependencyContainer): Promise<void>
}
