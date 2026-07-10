import { injectable } from '@/core/injection'
import type { AudioResponseFormat } from './IAudioSpeechSynthesizer'

/**
 * Controls when the bot answers with a synthesized voice message:
 * - `mirror`: only when the incoming message was audio (voice in → voice out)
 * - `always`: every reply gets a synthesized audio attachment
 * - `never`: text only
 */
export type ReplyWithVoiceMode = 'mirror' | 'always' | 'never'

/**
 * Audio capabilities for the chat channels. This is the single gate for the
 * audio flow: if `transcriptionModel` is null no inbound audio is transcribed
 * (and never analyzed), and if `synthesisModel` is null / `replyWithVoice` is
 * `never` no outbound audio is produced.
 *
 * Register it to enable audio, e.g.:
 * `container.register(AudioConfig, { useValue: new AudioConfig('whisper-1', 'tts-1') })`
 *
 * `provider` selects which registered audio adapter handles the request; when
 * omitted the first adapter registered via `runAudioAdapters([...])` is used.
 */
@injectable()
export class AudioConfig {
  constructor(
    public transcriptionModel: string | null = null,
    public synthesisModel: string | null = null,
    public voice: string = 'alloy',
    public format: AudioResponseFormat = 'mp3',
    public replyWithVoice: ReplyWithVoiceMode = 'mirror',
    public provider?: string,
  ) {}
}
