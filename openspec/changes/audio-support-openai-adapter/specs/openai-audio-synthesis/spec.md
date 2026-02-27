## ADDED Requirements

### Requirement: Synthesize text to audio

The system SHALL convert text to audio using OpenAI TTS API.

#### Scenario: Successful synthesis
- **WHEN** text is provided with voice and model configuration
- **THEN** system returns audio buffer with MIME type

#### Scenario: Returns audio metadata
- **WHEN** synthesis completes
- **THEN** audio includes metadata (provider, model, voice, format, sizeBytes)

### Requirement: Configurable TTS settings

The system SHALL allow configuration of TTS parameters via `OpenaiTtsConfig`.

#### Scenario: Default configuration
- **WHEN** no configuration is provided
- **THEN** system uses defaults: model "tts-1", voice "alloy", format "mp3"

#### Scenario: Custom configuration
- **WHEN** configuration specifies custom voice and format
- **THEN** system uses specified values for synthesis

### Requirement: Support multiple output formats

The system SHALL support multiple audio output formats.

#### Scenario: MP3 output
- **WHEN** format is "mp3"
- **THEN** system returns audio with MIME type "audio/mpeg"

#### Scenario: WAV output
- **WHEN** format is "wav"
- **THEN** system returns audio with MIME type "audio/wav"

#### Scenario: Opus output
- **WHEN** format is "opus"
- **THEN** system returns audio with MIME type "audio/opus"
