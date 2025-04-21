import { IMindset } from '@/mindset'
import { IConstructor } from '@/shared'
import { inject } from '@/injection'
import { v4 as uuidv4 } from 'uuid'

export function chatBot(mindset: IConstructor<IMindset>) {
  return function (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) {
    const injectionToken = uuidv4()
    inject(injectionToken)(target, propertyKey, parameterIndex)
  }
}
