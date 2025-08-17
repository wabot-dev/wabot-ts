export interface ICustomErrorData {
  message: string
  humanMessage?: string
  code?: string
  httpCode?: number
  cause?: Error
  info?: any
}

export class CustomError extends Error {
  humanMessage?: string
  code?: string
  httpCode?: number
  info?: any

  constructor(data: ICustomErrorData) {
    super(data.message, { cause: data.cause })
    this.humanMessage = data.humanMessage
    this.code = data.code
    this.httpCode = data.httpCode
  }
}
