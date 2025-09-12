import { IConstructor } from "@/core/generics"
import { ISocketConnectionConfig } from "./ISocketConnectionConfig"

export interface ISocketConnectionMetadata {
  config?: ISocketConnectionConfig
  controllerConstructor: IConstructor<any>
  functionName: string
  paramsTypes: any[]
}
