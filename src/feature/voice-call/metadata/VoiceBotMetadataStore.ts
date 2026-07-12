import { singleton } from '@/core/injection'
import { type IVoiceBotMetadata } from './IVoiceBotMetadata'

@singleton()
export class VoiceBotMetadataStore {
  private voiceBots: IVoiceBotMetadata[] = []

  saveVoiceBotMetadata(voiceBot: IVoiceBotMetadata) {
    this.voiceBots.push(voiceBot)
  }

  getVoiceBotsMetadata(): IVoiceBotMetadata[] {
    return this.voiceBots
  }
}
