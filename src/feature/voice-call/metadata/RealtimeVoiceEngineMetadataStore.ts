import { singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IRealtimeVoiceEngine } from '../IRealtimeVoiceEngine'
import { IRealtimeVoiceEngineMetadata } from './IRealtimeVoiceEngineMetadata'

@singleton()
export class RealtimeVoiceEngineMetadataStore {
  private engines = new Map<Function, IRealtimeVoiceEngineMetadata>()

  save(metadata: IRealtimeVoiceEngineMetadata) {
    this.engines.set(metadata.constructor, metadata)
  }

  get(ctor: IConstructor<IRealtimeVoiceEngine>): IRealtimeVoiceEngineMetadata | undefined {
    return this.engines.get(ctor)
  }
}
