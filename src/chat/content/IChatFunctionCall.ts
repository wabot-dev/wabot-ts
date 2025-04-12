export interface IChatFunctionCall {
  name: string
  arguments: {
    [key: string]: string
  }
  result: string
}
