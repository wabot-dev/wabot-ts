import { singleton } from '@/core/injection'
import { IChatAdapter } from './IChatAdapter'

@singleton()
export class ChatAdapterRegistry {
  private adapters = new Map<string, IChatAdapter>()
  private order: string[] = []

  register(provider: string, adapter: IChatAdapter) {
    if (!this.adapters.has(provider)) this.order.push(provider)
    this.adapters.set(provider, adapter)
  }

  get(provider: string): IChatAdapter | undefined {
    return this.adapters.get(provider)
  }

  defaultProvider(): string | undefined {
    return this.order[0]
  }

  size(): number {
    return this.adapters.size
  }
}
