export interface IAudioTranscribeReq {
  model: string
  audio: Buffer
}

export interface IAudioTranscribeRes {
  text: string
}

export interface IAudioTranscriber {
  transcribe(req: IAudioTranscribeReq): Promise<IAudioTranscribeRes>
}
