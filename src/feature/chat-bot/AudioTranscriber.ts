import { IAudioTranscribeReq, IAudioTranscribeRes, IAudioTranscriber } from './IAudioTranscriber'

/**
 * DI token for audio transcription. Register a concrete implementation with
 * `container.registerType(AudioTranscriber, OpenaiAudioTranscriber)`.
 */
export class AudioTranscriber implements IAudioTranscriber {
  transcribe(_req: IAudioTranscribeReq): Promise<IAudioTranscribeRes> {
    throw new Error('Method not implemented.')
  }
}
