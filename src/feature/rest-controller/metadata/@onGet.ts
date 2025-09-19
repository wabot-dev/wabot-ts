import { IEndPointConfig } from './IEndPointConfig'
import { methodDecorator } from './methodDecorator'

export function onGet(config?: string | IEndPointConfig) {
  return methodDecorator('get', config)
}
