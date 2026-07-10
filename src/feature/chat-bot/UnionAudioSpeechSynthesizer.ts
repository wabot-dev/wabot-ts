import { singleton } from '@/core/injection'
import { AudioAdapterRegistry } from './AudioAdapterRegistry'
import {
  IAudioSpeechSynthesizer,
  IAudioSynthesizeReq,
  IAudioSynthesizeRes,
} from './IAudioSpeechSynthesizer'

@singleton()
export class UnionAudioSpeechSynthesizer implements IAudioSpeechSynthesizer {
  constructor(private registry: AudioAdapterRegistry) {}

  async synthesize(req: IAudioSynthesizeReq): Promise<IAudioSynthesizeRes> {
    const provider = req.provider ?? this.registry.defaultSynthesizerProvider()
    if (!provider) {
      throw new Error(
        'No audio speech synthesizer registered. Call runAudioAdapters([...]) before synthesizing.',
      )
    }
    const adapter = this.registry.getSynthesizer(provider)
    if (!adapter) {
      throw new Error(`No audio speech synthesizer registered for provider '${provider}'`)
    }
    return adapter.synthesize(req)
  }
}
