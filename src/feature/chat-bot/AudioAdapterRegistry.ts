import { singleton } from '@/core/injection'
import { IAudioTranscriber } from './IAudioTranscriber'
import { IAudioSpeechSynthesizer } from './IAudioSpeechSynthesizer'

@singleton()
export class AudioAdapterRegistry {
  private transcribers = new Map<string, IAudioTranscriber>()
  private synthesizers = new Map<string, IAudioSpeechSynthesizer>()
  private transcriberOrder: string[] = []
  private synthesizerOrder: string[] = []

  registerTranscriber(provider: string, adapter: IAudioTranscriber) {
    if (!this.transcribers.has(provider)) this.transcriberOrder.push(provider)
    this.transcribers.set(provider, adapter)
  }

  registerSynthesizer(provider: string, adapter: IAudioSpeechSynthesizer) {
    if (!this.synthesizers.has(provider)) this.synthesizerOrder.push(provider)
    this.synthesizers.set(provider, adapter)
  }

  getTranscriber(provider: string): IAudioTranscriber | undefined {
    return this.transcribers.get(provider)
  }

  getSynthesizer(provider: string): IAudioSpeechSynthesizer | undefined {
    return this.synthesizers.get(provider)
  }

  defaultTranscriberProvider(): string | undefined {
    return this.transcriberOrder[0]
  }

  defaultSynthesizerProvider(): string | undefined {
    return this.synthesizerOrder[0]
  }

  transcriberCount(): number {
    return this.transcribers.size
  }

  synthesizerCount(): number {
    return this.synthesizers.size
  }
}
