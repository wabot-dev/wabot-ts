import { AudioResponseFormat, IAudioSpeechSynthesizer, IAudioTranscriber } from '@/feature/chat-bot'

export interface IAudioAdapterConformanceCase {
  name: string
  run: () => Promise<void>
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export interface IAudioSpeechSynthesizerConformanceReq {
  synthesizer: IAudioSpeechSynthesizer
  model: string
  voice: string
}

/**
 * Provider-agnostic conformance suite for IAudioSpeechSynthesizer implementations.
 * Runner-agnostic: each case is a plain async function.
 */
export function audioSpeechSynthesizerConformanceCases({
  synthesizer,
  model,
  voice,
}: IAudioSpeechSynthesizerConformanceReq): IAudioAdapterConformanceCase[] {
  const synthesize = (format: AudioResponseFormat) =>
    synthesizer.synthesize({ model, voice, text: 'Hello from Wabot, this is a test.', format })

  return [
    {
      name: 'synthesizes speech audio (mp3)',
      run: async () => {
        const res = await synthesize('mp3')
        ensure(Buffer.isBuffer(res.audio), 'audio should be a Buffer')
        ensure(res.audio.length > 0, 'audio should not be empty')
        ensure(res.format === 'mp3', 'format should echo the request')
        ensure(
          typeof res.mimeType === 'string' && res.mimeType.length > 0,
          'mimeType should be a non-empty string',
        )
      },
    },
    {
      name: 'honours the requested format (wav)',
      run: async () => {
        const res = await synthesize('wav')
        ensure(res.format === 'wav', 'format should be wav')
        ensure(res.audio.length > 0, 'audio should not be empty')
        ensure(res.mimeType.includes('wav'), 'mimeType should describe a wav payload')
      },
    },
  ]
}

export interface IAudioTranscriberConformanceSample {
  audio: Buffer
  mimeType: string
  /** At least one of these tokens must appear (case-insensitive) in the transcript. */
  expect: string[]
}

export interface IAudioTranscriberConformanceReq {
  transcriber: IAudioTranscriber
  model: string
  /** Produces the audio to transcribe (e.g. synthesized on demand or a fixture). */
  sample: () => Promise<IAudioTranscriberConformanceSample>
}

/**
 * Provider-agnostic conformance suite for IAudioTranscriber implementations.
 * The caller supplies the audio via `sample()`, keeping this decoupled from how
 * the audio is produced.
 */
export function audioTranscriberConformanceCases({
  transcriber,
  model,
  sample,
}: IAudioTranscriberConformanceReq): IAudioAdapterConformanceCase[] {
  return [
    {
      name: 'transcribes speech to text',
      run: async () => {
        const { audio, mimeType, expect } = await sample()
        const { text } = await transcriber.transcribe({ model, audio, mimeType })

        ensure(typeof text === 'string', 'text should be a string')
        ensure(text.trim().length > 0, 'transcript should not be empty')

        const normalized = text.toLowerCase()
        const matched = expect.some((token) => normalized.includes(token.toLowerCase()))
        ensure(matched, `transcript "${text}" should include one of: ${expect.join(', ')}`)
      },
    },
  ]
}
