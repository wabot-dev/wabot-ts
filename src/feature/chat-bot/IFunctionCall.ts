import { IStorableData } from "@/core/storable"

export interface IFunctionCall extends IStorableData {
  id: string
  name: string
  arguments?: string
  result?: string
}
