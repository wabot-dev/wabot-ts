import { IMindsetConfig } from "./IMindsetConfig"

export interface IMindsetDecoration {
  decorationName: string
  constructor: Function
  decorationConfig: IMindsetConfig
}
