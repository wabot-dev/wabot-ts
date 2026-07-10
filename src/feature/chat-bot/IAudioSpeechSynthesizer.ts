export type AudioResponseFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'

export interface IAudioSynthesizeReq {
  model: string
  voice: string
  text: string
  format?: AudioResponseFormat
  speed?: number
  provider?: string
}

export interface IAudioSynthesizeRes {
  audio: Buffer
  format: AudioResponseFormat
  mimeType: string
}

export interface IAudioSpeechSynthesizer {
  synthesize(req: IAudioSynthesizeReq): Promise<IAudioSynthesizeRes>
}
