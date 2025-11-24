import { IConstructor } from '@/core/generics'

export interface IDescriptionMetadata {
  constructor: IConstructor<any>
  propertyName: string
  propertyType?: Function
  functionArgsTypes?: Function[]
  functionReturnType?: Function
  description: string
}
