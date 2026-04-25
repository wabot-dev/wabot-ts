import {
  IAudioSpeechSynthesizer,
  IAudioSynthesizeReq,
  IAudioSynthesizeRes,
  AudioResponseFormat,
} from '@/feature/chat-bot/IAudioSpeechSynthesizer'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { OpenAI } from 'openai'

@singleton()
export class OpenaiAudioSpeechSynthesizer implements IAudioSpeechSynthesizer {
  private openai = new OpenAI()
  private logger = new Logger('wabot:openai-audio-speech-synthesizer')

  private readonly mimeMap: Record<AudioResponseFormat, string> = {
    mp3: 'audio/mpeg',
    opus: 'audio/opus',
    wav: 'audio/wav',
    aac: 'audio/aac',
    flac: 'audio/flac',
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

      const audioBuffer = Buffer.from(await response.arrayBuffer())
      const mimeType = this.mimeMap[format]

      this.logger.info('Audio synthesized', {
        textLength: req.text.length,
        audioSize: audioBuffer.length,
        format,
      })

      return {
        audio: audioBuffer,
        format,
        mimeType,
      }
    } catch (error) {
      this.logger.error('Failed to synthesize audio', error)
      throw new Error(`Audio synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
