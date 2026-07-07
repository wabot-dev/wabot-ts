import { container, injectable } from '@/core/injection'
import { type IConstructor } from '@/core/generics'
import { ToolMetadataStore } from './ToolMetadataStore'
import { type IToolsConfig } from './IToolsConfig'

/**
 * Marks a class as a set of tools: every `@description`-decorated method
 * becomes an LLM-callable function. Usable by both mindsets (end-user
 * chatbots) and agents (dev-facing). Replaces the mindset-only
 * `@mindsetModule`, which is kept as a deprecated alias.
 */
export function tools<A>(config?: IToolsConfig) {
  return function (target: IConstructor<A>) {
    const store = container.resolve(ToolMetadataStore)
    store.saveToolMetadata({
      constructor: target,
      config: config,
    })
    injectable()(target)
  }
}
