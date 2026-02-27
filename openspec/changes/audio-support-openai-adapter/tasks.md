## 1. Configuration

- [x] 1.1 Create `OpenaiTtsConfig` class with DI support (model, voice, format defaults)
- [x] 1.2 Update `src/addon/chat-bot/openai/index.ts` to export `OpenaiTtsConfig`

## 2. Transcription Implementation

- [x] 2.1 Create `OpenaiAudioTranscriber` implementing `IAudioTranscriber`
- [x] 2.2 Implement `transcribe()` method using OpenAI Whisper API
- [x] 2.3 Add error handling for invalid audio inputs
- [x] 2.4 Export `OpenaiAudioTranscriber` from index.ts

## 3. Synthesis Implementation

- [x] 3.1 Create `OpenaiAudioSpeechSynthesizer` implementing `IAudioSpeechSynthesizer`
- [x] 3.2 Implement `synthesize()` method using OpenAI TTS API
- [x] 3.3 Add MIME type mapping for all supported formats (mp3, wav, opus, aac, flac, pcm)
- [x] 3.4 Inject `OpenaiTtsConfig` for configuration
- [x] 3.5 Export `OpenaiAudioSpeechSynthesizer` from index.ts

## 4. Refactor OpenaiAudioChatAdapter

- [x] 4.1 Inject `OpenaiAudioTranscriber` and `OpenaiAudioSpeechSynthesizer` via DI
- [x] 4.2 Replace inline transcription with `transcriber.transcribe()` call
- [x] 4.3 Replace inline synthesis with `synthesizer.synthesize()` call
- [x] 4.4 Remove duplicated mapping logic

## 5. Testing

- [x] 5.1 Add unit tests for `OpenaiTtsConfig` defaults
- [x] 5.2 Add integration tests for `OpenaiAudioTranscriber`
- [x] 5.3 Add integration tests for `OpenaiAudioSpeechSynthesizer`
- [x] 5.4 Verify existing `OpenaiAudioChatAdapter` integration tests pass
