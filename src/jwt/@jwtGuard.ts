import { middleware } from "@/rest-controller"
import { JwtGuardMiddleware } from "./JwtGuardMiddleware"


export function jwtGuard() {
  return function (target: object, propertyKey: string | symbol) {
    middleware(JwtGuardMiddleware)(target, propertyKey)
  }
}
