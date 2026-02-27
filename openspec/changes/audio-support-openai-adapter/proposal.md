## Why

The OpenAI adapter has partial audio support but is incomplete and not properly modularized. The `OpenaiAudioChatAdapter` references `OpenaiTtsConfig` which doesn't exist, causing runtime errors. Additionally, the feature layer defines `IAudioTranscriber` and `IAudioSpeechSynthesizer` interfaces but lacks dedicated implementations, making audio features unusable.

## What Changes

- Create `OpenaiTtsConfig` class with DI support for TTS configuration
- Create `OpenaiAudioTranscriber` implementing `IAudioTranscriber` interface
- Create `OpenaiAudioSpeechSynthesizer` implementing `IAudioSpeechSynthesizer` interface
- Refactor `OpenaiAudioChatAdapter` to use the new modular components
- Add configuration options for transcription model (whisper-1) and TTS settings

## Capabilities

### New Capabilities

- `openai-audio-transcription`: Speech-to-text transcription using OpenAI Whisper API
- `openai-audio-synthesis`: Text-to-speech synthesis using OpenAI TTS API

### Modified Capabilities

- None (this is new functionality)

## Impact

- `src/addon/chat-bot/openai/` - New files and modifications to existing adapter
- `src/feature/chat-bot/` - No changes (interfaces already exist)
- Audio features will be fully functional for OpenAI provider
