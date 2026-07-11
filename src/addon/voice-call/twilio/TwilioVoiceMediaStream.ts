import { IVoiceMediaStream, VoiceAudioFormat } from '@/feature/voice-call'

/** Minimal socket surface so this adapter can be unit-tested without `ws`. */
export interface ITwilioMediaSocket {
  send(data: string): void
  close(): void
}

export interface ITwilioStreamStart {
  streamSid: string
  callSid?: string
  /** `<Parameter>` values from the TwiML (e.g. { from, to }). */
  customParameters: Record<string, string>
}

/**
 * Adapts Twilio's Media Streams WebSocket protocol to {@link IVoiceMediaStream}.
 * Twilio audio is base64 `audio/x-mulaw` @ 8 kHz — i.e. `g711_ulaw`, the same
 * codec OpenAI Realtime accepts, so frames pass through untouched.
 *
 * The `streamSid` needed to send audio back only arrives with the `start`
 * event, so `onStart` fires once it's known (that's when a session should be
 * started). Inbound audio that arrives before a listener is attached is buffered.
 */
export class TwilioVoiceMediaStream implements IVoiceMediaStream {
  readonly format: VoiceAudioFormat = 'g711_ulaw'

  private streamSid?: string
  private closed = false
  private audioBuffer: string[] = []
  private audioListeners: ((audioBase64: string) => void)[] = []
  private dtmfListeners: ((digit: string) => void)[] = []
  private closeListeners: (() => void)[] = []
  private startListeners: ((start: ITwilioStreamStart) => void)[] = []

  constructor(private socket: ITwilioMediaSocket) {}

  onAudio(listener: (audioBase64: string) => void) {
    this.audioListeners.push(listener)
    if (this.audioBuffer.length > 0) {
      const queued = this.audioBuffer
      this.audioBuffer = []
      for (const frame of queued) listener(frame)
    }
  }
  onDtmf(listener: (digit: string) => void) {
    this.dtmfListeners.push(listener)
  }
  onClose(listener: () => void) {
    this.closeListeners.push(listener)
  }
  /** Fires once the stream `start` event arrives (streamSid + call metadata known). */
  onStart(listener: (start: ITwilioStreamStart) => void) {
    this.startListeners.push(listener)
  }

  play(audioBase64: string) {
    if (this.closed || !this.streamSid) return
    this.socket.send(
      JSON.stringify({
        event: 'media',
        streamSid: this.streamSid,
        media: { payload: audioBase64 },
      }),
    )
  }
  clear() {
    if (this.closed || !this.streamSid) return
    this.socket.send(JSON.stringify({ event: 'clear', streamSid: this.streamSid }))
  }
  hangup() {
    this.close()
  }

  /** Feed a raw Twilio WebSocket text message. */
  handleMessage(raw: string) {
    let msg: Record<string, any>
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }

    switch (msg.event) {
      case 'start': {
        const start = msg.start ?? {}
        this.streamSid = start.streamSid ?? msg.streamSid
        const info: ITwilioStreamStart = {
          streamSid: this.streamSid ?? '',
          callSid: start.callSid,
          customParameters: start.customParameters ?? {},
        }
        this.startListeners.forEach((l) => l(info))
        break
      }
      case 'media': {
        const payload = msg.media?.payload
        if (typeof payload !== 'string') break
        if (this.audioListeners.length > 0) {
          this.audioListeners.forEach((l) => l(payload))
        } else {
          this.audioBuffer.push(payload)
        }
        break
      }
      case 'dtmf': {
        const digit = msg.dtmf?.digit
        if (typeof digit === 'string') this.dtmfListeners.forEach((l) => l(digit))
        break
      }
      case 'stop':
        this.close()
        break
    }
  }

  /** The underlying WebSocket closed. */
  handleClose() {
    this.close()
  }

  private close() {
    if (this.closed) return
    this.closed = true
    try {
      this.socket.close()
    } catch {
      // ignore
    }
    this.closeListeners.forEach((l) => l())
  }
}
