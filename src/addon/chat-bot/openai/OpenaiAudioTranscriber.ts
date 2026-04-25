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
  private readonly extensionByMimeType: Record<string, string> = {
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
  }

  async transcribe(req: IAudioTranscribeReq): Promise<IAudioTranscribeRes> {
    try {
      const file = await this.createAudioFile(req)
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

  private async createAudioFile(req: IAudioTranscribeReq): Promise<File> {
    const filename = this.resolveFilename(req)
    const mimeType = this.resolveMimeType(req)
    return toFile(req.audio, filename, mimeType ? { type: mimeType } : undefined)
  }

  private resolveFilename(req: IAudioTranscribeReq): string {
    if (req.filename) {
      const extension = this.getExtension(req.filename)
      const expectedExtension = req.mimeType ? this.extensionByMimeType[req.mimeType] : undefined

      if (expectedExtension && extension && expectedExtension !== extension) {
        throw new Error(
          `Audio metadata is inconsistent: filename extension ".${extension}" does not match mime type "${req.mimeType}"`,
        )
      }

      return req.filename
    }

    const extension = req.mimeType ? this.extensionByMimeType[req.mimeType] : undefined
    return `audio.${extension ?? 'wav'}`
  }

  private resolveMimeType(req: IAudioTranscribeReq): string | undefined {
    if (req.mimeType) return req.mimeType

    const extension = req.filename ? this.getExtension(req.filename) : undefined
    if (extension === 'mp3') return 'audio/mpeg'
    if (extension === 'wav') return 'audio/wav'
    return undefined
  }

  private getExtension(filename: string): string | undefined {
    const parts = filename.toLowerCase().split('.')
    return parts.length > 1 ? parts.at(-1) : undefined
  }
}
