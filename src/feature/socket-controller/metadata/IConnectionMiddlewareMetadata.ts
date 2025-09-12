import { IConstructor } from "@/core/generics"
import { IConnectionMiddleware } from "../IConnectionMiddleware"

export interface IConnectionMiddlewareMetadata {
  controllerConstructor: IConstructor<any>
  functionName: string
  middlewareConstructor: IConstructor<IConnectionMiddleware>
}
