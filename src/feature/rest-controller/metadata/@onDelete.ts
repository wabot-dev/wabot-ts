import { IEndPointConfig } from './IEndPointConfig'
import { methodDecorator } from './methodDecorator'

export function onDelete(config?: string | IEndPointConfig) {
  return methodDecorator('delete', config)
}
