import { container } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IRealtimeVoiceEngine } from '../IRealtimeVoiceEngine'
import { RealtimeVoiceEngineMetadataStore } from './RealtimeVoiceEngineMetadataStore'

export interface IRealtimeVoiceEngineDecoratorConfig {
  provider: string
}

export function realtimeVoiceEngine(config: IRealtimeVoiceEngineDecoratorConfig) {
  return function (target: IConstructor<IRealtimeVoiceEngine>) {
    const store = container.resolve(RealtimeVoiceEngineMetadataStore)
    store.save({ constructor: target, provider: config.provider })
  }
}
