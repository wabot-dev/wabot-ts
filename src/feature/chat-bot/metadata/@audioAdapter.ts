import { container } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IAudioTranscriber } from '../IAudioTranscriber'
import { IAudioSpeechSynthesizer } from '../IAudioSpeechSynthesizer'
import { AudioAdapterMetadataStore } from './AudioAdapterMetadataStore'

export interface IAudioAdapterDecoratorConfig {
  provider: string
}

export function audioTranscriber(config: IAudioAdapterDecoratorConfig) {
  return function (target: IConstructor<IAudioTranscriber>) {
    const store = container.resolve(AudioAdapterMetadataStore)
    store.save({ constructor: target, provider: config.provider, kind: 'transcriber' })
  }
}

export function audioSpeechSynthesizer(config: IAudioAdapterDecoratorConfig) {
  return function (target: IConstructor<IAudioSpeechSynthesizer>) {
    const store = container.resolve(AudioAdapterMetadataStore)
    store.save({ constructor: target, provider: config.provider, kind: 'synthesizer' })
  }
}
