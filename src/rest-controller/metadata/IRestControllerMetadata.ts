import { IConstructor } from "@/core"

export interface IRestControllerMetadata {
  controllerConstructor: IConstructor<any>
  path: string
}
