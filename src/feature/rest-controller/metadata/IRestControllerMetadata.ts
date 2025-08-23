import { IConstructor } from '@/core/generics'

export interface IRestControllerMetadata {
  controllerConstructor: IConstructor<any>
  path: string
}
