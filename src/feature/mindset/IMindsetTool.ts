import { IMindsetToolParameter } from './IMindsetToolParameter'

export interface IMindsetTool {
  language: string
  name: string
  description: string
  parameters: IMindsetToolParameter[]
}
