import { IEndPointConfig } from './IEndPointConfig'
import { methodDecorator } from './methodDecorator'

export function onPut(config?: string | IEndPointConfig) {
  return methodDecorator('put', config)
}
