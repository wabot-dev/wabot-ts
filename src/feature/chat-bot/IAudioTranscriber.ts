export interface IAudioTranscribeReq {
  model: string
  audio: Buffer
  mimeType?: string
  filename?: string
}

export interface IAudioTranscribeRes {
  text: string
}

export interface IAudioTranscriber {
  transcribe(req: IAudioTranscribeReq): Promise<IAudioTranscribeRes>
}
