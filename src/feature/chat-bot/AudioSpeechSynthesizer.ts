import {
  IAudioSpeechSynthesizer,
  IAudioSynthesizeReq,
  IAudioSynthesizeRes,
} from './IAudioSpeechSynthesizer'

/**
 * DI token for speech synthesis (TTS). Register a concrete implementation with
 * `container.registerType(AudioSpeechSynthesizer, OpenaiAudioSpeechSynthesizer)`.
 */
export class AudioSpeechSynthesizer implements IAudioSpeechSynthesizer {
  synthesize(_req: IAudioSynthesizeReq): Promise<IAudioSynthesizeRes> {
    throw new Error('Method not implemented.')
  }
}
