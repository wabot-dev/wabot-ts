import { singleton } from '@/core/injection'
import { IRealtimeVoiceEngine } from './IRealtimeVoiceEngine'

@singleton()
export class RealtimeVoiceEngineRegistry {
  private engines = new Map<string, IRealtimeVoiceEngine>()
  private order: string[] = []

  register(provider: string, engine: IRealtimeVoiceEngine) {
    if (!this.engines.has(provider)) this.order.push(provider)
    this.engines.set(provider, engine)
  }

  get(provider: string): IRealtimeVoiceEngine | undefined {
    return this.engines.get(provider)
  }

  defaultProvider(): string | undefined {
    return this.order[0]
  }

  size(): number {
    return this.engines.size
  }
}
