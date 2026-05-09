import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { IMindsetModelRef } from '@/feature/mindset'
import { ChatAdapterRegistry } from './ChatAdapterRegistry'
import { IChatAdapter, IChatAdapterNextItemsReq, IChatAdapterNextItemsRes } from './IChatAdapter'

interface IProviderGroup {
  provider: string
  entries: IMindsetModelRef[]
}

@singleton()
export class UnionChatAdapter implements IChatAdapter {
  private logger = new Logger('wabot:union-chat-adapter')

  constructor(private registry: ChatAdapterRegistry) {}

  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    if (this.registry.size() === 0) {
      throw new Error(
        'No chat adapters registered. Call runChatAdapters([...]) before sending messages.',
      )
    }
    if (req.models.length === 0) {
      throw new Error('UnionChatAdapter received empty models list')
    }

    const groups = this.groupByProvider(req.models)
    let lastError: unknown

    for (const group of groups) {
      const adapter = this.registry.get(group.provider)
      if (!adapter) {
        this.logger.warn(`No adapter registered for provider '${group.provider}', skipping group`)
        continue
      }
      try {
        return await adapter.nextItems({ ...req, models: group.entries })
      } catch (err) {
        this.logger.warn(
          `Adapter for provider '${group.provider}' failed, trying next group`,
          err instanceof Error ? { message: err.message } : { err },
        )
        lastError = err
      }
    }

    throw lastError ?? new Error('No adapter could handle the request')
  }

  private groupByProvider(models: IMindsetModelRef[]): IProviderGroup[] {
    const fallbackProvider = this.registry.defaultProvider()
    const groups: IProviderGroup[] = []
    for (const ref of models) {
      const provider = ref.provider ?? fallbackProvider
      if (!provider) continue
      const last = groups[groups.length - 1]
      if (last && last.provider === provider) {
        last.entries.push(ref)
      } else {
        groups.push({ provider, entries: [ref] })
      }
    }
    return groups
  }
}
