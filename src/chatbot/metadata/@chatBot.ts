import { IMindset } from '@/mindset'
import { IchatBotConfig } from './IchatBotConfig'
import { IConstructor } from '@/shared'

export function chatBot(mindset: IConstructor<IMindset>, config?: IchatBotConfig) {
  return function (target: object, parameterIndex: any, b: any) {}
}
