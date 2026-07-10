import { IConstructor } from '@/core/generics'
import { IAudioTranscriber } from '../IAudioTranscriber'
import { IAudioSpeechSynthesizer } from '../IAudioSpeechSynthesizer'

export type AudioAdapterKind = 'transcriber' | 'synthesizer'

export interface IAudioAdapterMetadata {
  constructor: IConstructor<IAudioTranscriber | IAudioSpeechSynthesizer>
  provider: string
  kind: AudioAdapterKind
}
