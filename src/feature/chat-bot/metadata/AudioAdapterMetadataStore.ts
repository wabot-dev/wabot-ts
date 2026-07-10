import { singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IAudioTranscriber } from '../IAudioTranscriber'
import { IAudioSpeechSynthesizer } from '../IAudioSpeechSynthesizer'
import { IAudioAdapterMetadata } from './IAudioAdapterMetadata'

@singleton()
export class AudioAdapterMetadataStore {
  private adapters = new Map<Function, IAudioAdapterMetadata>()

  save(metadata: IAudioAdapterMetadata) {
    this.adapters.set(metadata.constructor, metadata)
  }

  get(
    ctor: IConstructor<IAudioTranscriber | IAudioSpeechSynthesizer>,
  ): IAudioAdapterMetadata | undefined {
    return this.adapters.get(ctor)
  }
}
