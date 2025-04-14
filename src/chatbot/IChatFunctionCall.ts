export interface IChatFunctionCall {
  foreignId?: string
  name: string
  arguments: {
    [key: string]: string
  }
  result: string
}
