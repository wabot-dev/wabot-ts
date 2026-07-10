import { type IConstructor } from '@/core/generics'
// Type-only import: keeps this a compile-time reference so there is no runtime
// module cycle between the mindset and agent features.
import type { IMindsetAgentBinding } from '@/feature/agent/MindsetAgentToolset'

export interface IMindsetConfig {
  /** `@tools` classes the mindset can call directly. */
  tools?: IConstructor<any>[]
  /**
   * @deprecated Use {@link IMindsetConfig.tools} instead. Kept as an alias for
   * backwards compatibility; when both are set they are merged.
   */
  modules?: IConstructor<any>[]
  /**
   * Agents the mindset can call autonomously. Each becomes a callable tool in the
   * mindset's schema; invoking it runs a fresh, isolated agent session and feeds
   * the agent's reply back into the chat loop. Use the object binding form to
   * gate which of the agent's tools are reachable (`allow`/`deny`).
   */
  agents?: IMindsetAgentBinding[]
}

/**
 * The `@tools` classes a mindset exposes: the preferred `tools` plus the
 * deprecated `modules` alias, merged and de-duplicated (same class listed in
 * both counts once).
 */
export function mindsetToolClasses(config?: IMindsetConfig): IConstructor<any>[] {
  return [...new Set([...(config?.tools ?? []), ...(config?.modules ?? [])])]
}
