import { IConstructor } from '@/core/generics'
import { IRealtimeVoiceEngine } from '../IRealtimeVoiceEngine'

export interface IRealtimeVoiceEngineMetadata {
  constructor: IConstructor<IRealtimeVoiceEngine>
  provider: string
}
