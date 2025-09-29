import { connectionMiddleware } from '@/feature/socket-controller'
import { ApiKeyConnectionGuardMiddleware } from './ApiKeyConnectionGuardMiddleware'

export function apiKeyConnectionGuard() {
  return function (target: object, propertyKey: string | symbol) {
    connectionMiddleware(ApiKeyConnectionGuardMiddleware)(target, propertyKey)
  }
}
