import { container } from '@/core/injection'
import { Logger } from '@/core/logger'
import { AudioConfig, AudioSpeechSynthesizer, AudioTranscriber } from '@/feature/chat-bot'
import { AudioGateway } from './AudioGateway'

const logger = new Logger('wabot:audio-gateway')

/**
 * Resolves the {@link AudioGateway} only when audio has been opted into (an
 * {@link AudioConfig} plus the transcriber/synthesizer tokens are registered).
 * Returns null otherwise, so channels stay text-only by default.
 */
export function resolveAudioGateway(): AudioGateway | null {
  if (!container.isRegistered(AudioConfig)) return null
  if (
    !container.isRegistered(AudioTranscriber) ||
    !container.isRegistered(AudioSpeechSynthesizer)
  ) {
    logger.warn(
      'AudioConfig is registered but AudioTranscriber/AudioSpeechSynthesizer are not; audio disabled',
    )
    return null
  }
  return container.resolve(AudioGateway)
}
