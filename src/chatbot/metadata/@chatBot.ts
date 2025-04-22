import { IMindset } from '@/mindset'
import { IConstructor } from '@/shared'
import { container, inject } from '@/injection'
import { v4 as uuidv4 } from 'uuid'
import { ChatBotMetadataStore } from './ChatBotMetadataStore'

export function chatBot(mindset: IConstructor<IMindset>) {
  return function (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) {
    const injectionToken = `ChatBot-${mindset.name}-${uuidv4()}`
    const metadataStore = container.resolve(ChatBotMetadataStore)
    metadataStore.saveChatBotMetadata({
      constructor: target as IConstructor<any>,
      mindsetConstructor: mindset,
      injectionToken,
    })

    inject(injectionToken)(target, propertyKey, parameterIndex)
  }
}
