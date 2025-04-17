import { IMindsetConfig } from "./@mindset"

export interface IMindsetDecoration {
  decorationName: string
  constructor: Function
  decorationConfig: IMindsetConfig
}
