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
    this.info = data.info
  }
}

export function errorToPlainObject(error: Error): Record<string, any> {
  const { name, message, stack } = error
  const extra: Record<string, any> = {}
  for (const key of Object.keys(error)) {
    if (key === 'message' || key === 'stack') continue
    extra[key] = (error as any)[key]
  }
  return { name, message, stack, ...extra }
}
