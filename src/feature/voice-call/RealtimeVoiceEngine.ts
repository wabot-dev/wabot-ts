import {
  IRealtimeVoiceEngine,
  IRealtimeVoiceEngineSession,
  IRealtimeVoiceSessionConfig,
} from './IRealtimeVoiceEngine'

/**
 * DI token for the realtime voice engine. Register a concrete engine with
 * `runRealtimeVoiceEngines([OpenaiRealtimeVoiceEngine])`, which binds this token
 * to the provider-routing union.
 */
export class RealtimeVoiceEngine implements IRealtimeVoiceEngine {
  open(_config: IRealtimeVoiceSessionConfig): Promise<IRealtimeVoiceEngineSession> {
    throw new Error('Method not implemented.')
  }
}
