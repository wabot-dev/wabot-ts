import { container } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { AudioSpeechSynthesizer } from './AudioSpeechSynthesizer'
import { AudioTranscriber } from './AudioTranscriber'
import { AudioAdapterRegistry } from './AudioAdapterRegistry'
import { IAudioSpeechSynthesizer } from './IAudioSpeechSynthesizer'
import { IAudioTranscriber } from './IAudioTranscriber'
import { UnionAudioSpeechSynthesizer } from './UnionAudioSpeechSynthesizer'
import { UnionAudioTranscriber } from './UnionAudioTranscriber'
import { AudioAdapterMetadataStore } from './metadata'

/**
 * Registers audio transcribers/synthesizers by provider and binds the
 * {@link AudioTranscriber} / {@link AudioSpeechSynthesizer} tokens to union
 * implementations that route by provider. Mirrors {@link runChatAdapters}.
 *
 * Which models a bot uses is declared in its mindset `models()` (speechToText /
 * textToSpeech); this only registers the per-provider adapters. The runner
 * auto-loads these, so apps rarely call it directly.
 */
export function runAudioAdapters(
  adapters: IConstructor<IAudioTranscriber | IAudioSpeechSynthesizer>[],
) {
  const store = container.resolve(AudioAdapterMetadataStore)
  const registry = container.resolve(AudioAdapterRegistry)

  for (const ctor of adapters) {
    const meta = store.get(ctor)
    if (!meta) {
      throw new Error(
        `${ctor.name} is missing the @audioTranscriber/@audioSpeechSynthesizer decorator and cannot be registered`,
      )
    }
    const instance = container.resolve(ctor)
    if (meta.kind === 'transcriber') {
      registry.registerTranscriber(meta.provider, instance as IAudioTranscriber)
    } else {
      registry.registerSynthesizer(meta.provider, instance as IAudioSpeechSynthesizer)
    }
  }

  container.register(AudioTranscriber, { useToken: UnionAudioTranscriber })
  container.register(AudioSpeechSynthesizer, { useToken: UnionAudioSpeechSynthesizer })
}
