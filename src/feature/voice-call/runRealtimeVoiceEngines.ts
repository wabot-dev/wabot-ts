import { container } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IRealtimeVoiceEngine } from './IRealtimeVoiceEngine'
import { RealtimeVoiceEngine } from './RealtimeVoiceEngine'
import { RealtimeVoiceEngineRegistry } from './RealtimeVoiceEngineRegistry'
import { UnionRealtimeVoiceEngine } from './UnionRealtimeVoiceEngine'
import { RealtimeVoiceEngineMetadataStore } from './metadata'

/**
 * Registers realtime voice engines by provider and binds the
 * {@link RealtimeVoiceEngine} token to the provider-routing union. Mirrors
 * `runChatAdapters` / `runAudioAdapters`.
 */
export function runRealtimeVoiceEngines(engines: IConstructor<IRealtimeVoiceEngine>[]) {
  const store = container.resolve(RealtimeVoiceEngineMetadataStore)
  const registry = container.resolve(RealtimeVoiceEngineRegistry)

  for (const ctor of engines) {
    const meta = store.get(ctor)
    if (!meta) {
      throw new Error(
        `${ctor.name} is missing the @realtimeVoiceEngine({ provider }) decorator and cannot be registered`,
      )
    }
    registry.register(meta.provider, container.resolve(ctor))
  }

  container.register(RealtimeVoiceEngine, { useToken: UnionRealtimeVoiceEngine })
}
