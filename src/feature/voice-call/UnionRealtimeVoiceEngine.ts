import { singleton } from '@/core/injection'
import { RealtimeVoiceEngineRegistry } from './RealtimeVoiceEngineRegistry'
import {
  IRealtimeVoiceEngine,
  IRealtimeVoiceEngineSession,
  IRealtimeVoiceSessionConfig,
} from './IRealtimeVoiceEngine'

@singleton()
export class UnionRealtimeVoiceEngine implements IRealtimeVoiceEngine {
  constructor(private registry: RealtimeVoiceEngineRegistry) {}

  open(config: IRealtimeVoiceSessionConfig): Promise<IRealtimeVoiceEngineSession> {
    const provider = config.provider ?? this.registry.defaultProvider()
    if (!provider) {
      throw new Error(
        'No realtime voice engine registered. Call runRealtimeVoiceEngines([...]) before starting a call.',
      )
    }
    const engine = this.registry.get(provider)
    if (!engine) {
      throw new Error(`No realtime voice engine registered for provider '${provider}'`)
    }
    return engine.open(config)
  }
}
