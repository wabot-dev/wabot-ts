export interface IMindsetToolParameter {
  type: string
  name: string
  description: string
}

export interface IMindsetTool {
  language: string
  name: string
  description: string
  parameters: IMindsetToolParameter[]
}