import { connectionMiddleware } from "@/feature/socket-controller"
import { JwtConnectionGuardMiddleware } from "./JwtConnectionGuardMiddleware"


export function jwtConnectionGuard() {
  return function (target: object, propertyKey: string | symbol) {
    connectionMiddleware(JwtConnectionGuardMiddleware)(target, propertyKey)
  }
}
