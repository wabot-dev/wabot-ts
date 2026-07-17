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
  private markListeners: ((name: string) => void)[] = []
  private markSeq = 0
  private outstandingMarks = 0

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
  /** Fires when Twilio confirms a played chunk (its `mark` echo). */
  onMark(listener: (name: string) => void) {
    this.markListeners.push(listener)
  }
  /** How many played chunks have not yet been confirmed by Twilio. */
  get pendingPlayback(): number {
    return this.outstandingMarks
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
    // Tag each chunk with a mark so Twilio echoes it back when playback finishes.
    const name = `m${++this.markSeq}`
    this.outstandingMarks++
    this.socket.send(JSON.stringify({ event: 'mark', streamSid: this.streamSid, mark: { name } }))
  }
  clear() {
    if (this.closed || !this.streamSid) return
    // Twilio drops queued audio (and its pending marks) on clear.
    this.outstandingMarks = 0
    this.socket.send(JSON.stringify({ event: 'clear', streamSid: this.streamSid }))
  }
  hangup() {
    this.close()
  }

  /**
   * Resolve once Twilio has echoed the marks for every queued chunk (playback
   * finished), or the stream closes, or `timeoutMs` elapses — whichever comes
   * first. Lets the caller hear the bot's final words before we hang up.
   */
  waitForDrain(timeoutMs = 5000): Promise<void> {
    if (this.closed || this.outstandingMarks === 0) return Promise.resolve()
    return new Promise<void>((resolve) => {
      let settled = false
      const settle = () => {
        if (settled) return
        settled = true
        this.markListeners = this.markListeners.filter((l) => l !== onMark)
        this.closeListeners = this.closeListeners.filter((l) => l !== settle)
        clearTimeout(timer)
        resolve()
      }
      // A mark echo decrements outstandingMarks before listeners fire, so
      // reaching zero here means the last queued chunk finished playing.
      const onMark = () => {
        if (this.outstandingMarks === 0) settle()
      }
      const timer = setTimeout(settle, timeoutMs)
      this.markListeners.push(onMark)
      this.closeListeners.push(settle)
    })
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
      case 'mark': {
        if (this.outstandingMarks > 0) this.outstandingMarks--
        const name = msg.mark?.name
        if (typeof name === 'string') this.markListeners.forEach((l) => l(name))
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
