import { container } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { ChatAdapter } from './ChatAdapter'
import { ChatAdapterRegistry } from './ChatAdapterRegistry'
import { IChatAdapter } from './IChatAdapter'
import { UnionChatAdapter } from './UnionChatAdapter'
import { ChatAdapterMetadataStore } from './metadata'

export function runChatAdapters(adapters: IConstructor<IChatAdapter>[]) {
  const store = container.resolve(ChatAdapterMetadataStore)
  const registry = container.resolve(ChatAdapterRegistry)

  for (const ctor of adapters) {
    const meta = store.get(ctor)
    if (!meta) {
      throw new Error(
        `${ctor.name} is missing the @chatAdapter({ provider }) decorator and cannot be registered`,
      )
    }
    registry.register(meta.provider, container.resolve(ctor))
  }

  container.register(ChatAdapter, { useToken: UnionChatAdapter })
}
