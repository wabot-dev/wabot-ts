import {
  IAudioTranscriber,
  IAudioTranscribeReq,
  IAudioTranscribeRes,
} from '@/feature/chat-bot/IAudioTranscriber'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { OpenAI, toFile } from 'openai'

@singleton()
export class OpenaiAudioTranscriber implements IAudioTranscriber {
  private openai = new OpenAI()
  private logger = new Logger('wabot:openai-audio-transcriber')

  async transcribe(req: IAudioTranscribeReq): Promise<IAudioTranscribeRes> {
    try {
      const file = await toFile(req.audio, 'audio.wav')
      const response = await this.openai.audio.transcriptions.create({
        model: req.model,
        file,
        response_format: 'text',
      })

      const text = typeof response === 'string' ? response : ''
      this.logger.info('Audio transcribed', { textLength: text.length })
      return { text }
    } catch (error) {
      this.logger.error('Failed to transcribe audio', error)
      throw new Error(
        `Audio transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
}
