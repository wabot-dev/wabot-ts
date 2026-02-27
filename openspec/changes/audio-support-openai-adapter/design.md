## Context

The OpenAI adapter needs modular audio support with two distinct capabilities:
1. **Transcription**: Speech-to-text using OpenAI Whisper API
2. **Synthesis**: Text-to-speech using OpenAI TTS API

Currently, `OpenaiAudioChatAdapter` combines both functionalities but references a missing `OpenaiTtsConfig` class, causing runtime errors. The feature layer already defines the interfaces (`IAudioTranscriber`, `IAudioSpeechSynthesizer`) but lacks implementations.

## Goals / Non-Goals

**Goals:**
- Create `OpenaiTtsConfig` for configurable TTS settings (voice, model, format)
- Implement `OpenaiAudioTranscriber` using OpenAI Whisper API
- Implement `OpenaiAudioSpeechSynthesizer` using OpenAI TTS API
- Refactor `OpenaiAudioChatAdapter` to use modular components via DI
- Maintain backward compatibility with existing chat adapter behavior

**Non-Goals:**
- Real-time streaming audio (future enhancement)
- Audio format conversion/transcoding
- Multi-provider audio abstraction (only OpenAI)

## Decisions

### 1. Separate Transcriber and Synthesizer Classes

**Decision**: Create dedicated classes for each audio capability rather than embedding in `OpenaiAudioChatAdapter`.

**Rationale**: 
- Follows Single Responsibility Principle
- Enables independent testing and reuse
- Matches existing interface definitions in feature layer
- Allows channels to use transcription without synthesis (or vice versa)

**Alternatives considered**:
- Single `OpenaiAudioService` class: Rejected due to tight coupling
- Keep all in `OpenaiAudioChatAdapter`: Rejected - violates separation of concerns

### 2. Configuration via DI-Injected Config Classes

**Decision**: Use injectable config classes (`OpenaiTtsConfig`) following wabot patterns.

**Rationale**:
- Consistent with framework's DI-based architecture
- Allows environment-based configuration
- Testable via mock configs

### 3. TTS Configuration Defaults

**Decision**: Default to `tts-1` model, `alloy` voice, `mp3` format.

**Rationale**:
- `tts-1` is faster and cheaper than `tts-1-hd` for most use cases
- `alloy` is a neutral, widely-used voice
- `mp3` has broad compatibility across platforms

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Audio files consume memory | Buffer handling via streams not implemented in V1; document size limits |
| Whisper API costs per minute | Configurable model selection; log usage metrics |
| Missing `OpenaiTtsConfig` breaks existing code | Create class immediately; adapter already references it |
