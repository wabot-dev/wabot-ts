import {
  audioSpeechSynthesizer,
  AudioResponseFormat,
  IAudioSpeechSynthesizer,
  IAudioSynthesizeReq,
  IAudioSynthesizeRes,
} from '@/feature/chat-bot'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { OpenAI } from 'openai'

@audioSpeechSynthesizer({ provider: 'openai' })
@singleton()
export class OpenaiAudioSpeechSynthesizer implements IAudioSpeechSynthesizer {
  private openai = new OpenAI()
  private logger = new Logger('wabot:openai-audio-speech-synthesizer')

  private readonly mimeByFormat: Record<AudioResponseFormat, string> = {
    mp3: 'audio/mpeg',
    opus: 'audio/ogg',
    aac: 'audio/aac',
    flac: 'audio/flac',
    wav: 'audio/wav',
    pcm: 'audio/pcm',
  }

  async synthesize(req: IAudioSynthesizeReq): Promise<IAudioSynthesizeRes> {
    const format = req.format ?? 'mp3'
    try {
      const response = await this.openai.audio.speech.create({
        model: req.model,
        voice: req.voice,
        input: req.text,
        response_format: format,
        speed: req.speed,
      })

      const audio = Buffer.from(await response.arrayBuffer())
      const mimeType = this.mimeByFormat[format]

      this.logger.info('audio synthesized', {
        textLength: req.text.length,
        audioSize: audio.length,
        format,
      })

      return { audio, format, mimeType }
    } catch (error) {
      this.logger.error(
        'failed to synthesize audio',
        error instanceof Error ? { message: error.message } : { error },
      )
      throw new Error(
        `Audio synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
}
