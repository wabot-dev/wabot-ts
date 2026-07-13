import { singleton } from '@/core/injection'
import { AudioAdapterRegistry } from './AudioAdapterRegistry'
import { IAudioTranscribeReq, IAudioTranscribeRes, IAudioTranscriber } from './IAudioTranscriber'

@singleton()
export class UnionAudioTranscriber implements IAudioTranscriber {
  constructor(private registry: AudioAdapterRegistry) {}

  async transcribe(req: IAudioTranscribeReq): Promise<IAudioTranscribeRes> {
    const provider = req.provider ?? this.registry.defaultTranscriberProvider()
    if (!provider) {
      throw new Error(
        'No audio transcriber registered. Call runAudioAdapters([...]) before transcribing.',
      )
    }
    const adapter = this.registry.getTranscriber(provider)
    if (!adapter) {
      throw new Error(`No audio transcriber registered for provider '${provider}'`)
    }
    return adapter.transcribe(req)
  }
}
