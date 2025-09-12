import { middleware } from '@/feature/rest-controller'
import { ApiKeyGuardMiddleware } from './ApiKeyGuardMiddleware'

export function apiKeyGuard() {
  return function (target: object, propertyKey: string | symbol) {
    middleware(ApiKeyGuardMiddleware)(target, propertyKey)
  }
}
