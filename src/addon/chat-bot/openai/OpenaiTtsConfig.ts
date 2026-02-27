import { injectable } from '@/core/injection'
import type { AudioResponseFormat } from '@/feature/chat-bot'

@injectable()
export class OpenaiTtsConfig {
  constructor(
    public model: string = 'tts-1',
    public voice: string = 'alloy',
    public format: AudioResponseFormat = 'mp3',
  ) {}
}
