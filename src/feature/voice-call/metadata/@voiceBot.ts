import { randomUUID } from 'node:crypto'
import { type IMindset } from '@/feature/mindset'
import { container, inject } from '@/core/injection'
import type { IConstructor } from '@/core/generics'
import { VoiceBotMetadataStore } from './VoiceBotMetadataStore'

/**
 * Injects a VoiceBot bound to `mindset` into a voice controller — the voice
 * analogue of `@chatBot`. Inject several to route different calls to different
 * mindsets.
 */
export function voiceBot(mindset: IConstructor<IMindset>) {
  return function (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) {
    const injectionToken = `VoiceBot-${mindset.name}-${randomUUID()}`
    container.resolve(VoiceBotMetadataStore).saveVoiceBotMetadata({
      constructor: target as IConstructor<any>,
      mindsetConstructor: mindset,
      injectionToken,
    })
    inject(injectionToken)(target, propertyKey, parameterIndex)
  }
}
