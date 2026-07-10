import { injectable } from '@/core/injection'
import { Logger } from '@/core/logger'
import { randomUUID } from 'node:crypto'
import {
  AudioConfig,
  AudioSpeechSynthesizer,
  AudioTranscriber,
  IChatMessageAudio,
} from '@/feature/chat-bot'

/**
 * Runs transcription and synthesis at the channel boundary so the chat adapters
 * stay text-only. Honours {@link AudioConfig}: when a model is not configured
 * the corresponding capability is a no-op.
 */
@injectable()
export class AudioGateway {
  private logger = new Logger('wabot:audio-gateway')

  constructor(
    private transcriber: AudioTranscriber,
    private synthesizer: AudioSpeechSynthesizer,
    private config: AudioConfig,
  ) {}

  get canTranscribe(): boolean {
    return !!this.config.transcriptionModel
  }

  /** Transcript text, or undefined when transcription is disabled/failed/empty. */
  async transcribe(audio: IChatMessageAudio): Promise<string | undefined> {
    if (!this.config.transcriptionModel) return undefined
    try {
      const buffer = await this.toBuffer(audio)
      const { text } = await this.transcriber.transcribe({
        model: this.config.transcriptionModel,
        audio: buffer,
        mimeType: audio.mimeType,
        filename: audio.name,
        provider: this.config.provider,
      })
      return text?.trim() || undefined
    } catch (err) {
      this.logger.error(
        'failed to transcribe inbound audio',
        err instanceof Error ? { message: err.message } : { err },
      )
      return undefined
    }
  }

  shouldReplyWithVoice(inboundWasAudio: boolean): boolean {
    if (!this.config.synthesisModel) return false
    switch (this.config.replyWithVoice) {
      case 'always':
        return true
      case 'mirror':
        return inboundWasAudio
      default:
        return false
    }
  }

  /** Synthesized audio for the given text, or undefined when disabled/failed. */
  async synthesize(text: string): Promise<IChatMessageAudio | undefined> {
    if (!this.config.synthesisModel) return undefined
    try {
      const res = await this.synthesizer.synthesize({
        model: this.config.synthesisModel,
        voice: this.config.voice,
        text,
        format: this.config.format,
        provider: this.config.provider,
      })
      return {
        id: randomUUID(),
        mimeType: res.mimeType,
        base64Url: `data:${res.mimeType};base64,${res.audio.toString('base64')}`,
      }
    } catch (err) {
      this.logger.error(
        'failed to synthesize reply audio',
        err instanceof Error ? { message: err.message } : { err },
      )
      return undefined
    }
  }

  private async toBuffer(audio: IChatMessageAudio): Promise<Buffer> {
    if (audio.base64Url) {
      const base64 = audio.base64Url.includes(',')
        ? audio.base64Url.slice(audio.base64Url.indexOf(',') + 1)
        : audio.base64Url
      return Buffer.from(base64, 'base64')
    }
    if (!audio.publicUrl) throw new Error('audio has neither base64Url nor publicUrl')
    const res = await fetch(audio.publicUrl)
    if (!res.ok) throw new Error(`failed to fetch audio: ${res.status} ${res.statusText}`)
    return Buffer.from(await res.arrayBuffer())
  }
}
