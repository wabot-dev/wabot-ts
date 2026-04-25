export interface IAudioMetadata {
  provider: 'openai'
  model: string
  voice?: string
  format: 'mp3' | 'opus' | 'wav' | 'aac' | 'flac' | 'pcm'
  sizeBytes: number
  durationMs?: number
  sampleRateHz?: number
  channels?: number
  codec?: string
  createdAt: string
}

export interface IChatMessageAudioPublic {
  name?: string
  publicUrl: string
  base64Url?: undefined
  mimeType: string
  metadata?: IAudioMetadata
}

export interface IChatMessageAudioPrivate {
  name?: string
  publicUrl?: undefined
  base64Url: string
  mimeType: string
  metadata?: IAudioMetadata
}

export type IChatMessageAudio = IChatMessageAudioPublic | IChatMessageAudioPrivate
