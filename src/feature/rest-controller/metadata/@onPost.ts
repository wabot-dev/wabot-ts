import { IEndPointConfig } from './IEndPointConfig'
import { methodDecorator } from './methodDecorator'

export function onPost(config?: string | IEndPointConfig) {
  return methodDecorator('post', config)
}
