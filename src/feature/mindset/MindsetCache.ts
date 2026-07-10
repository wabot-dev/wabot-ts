import { singleton } from '@/core/injection'
import { IMindsetDescription, IMindsetModels } from './IMindset'

/** A mindset's loaded persona + models, with the time it was computed. */
export interface ILoadedMindset {
  description: IMindsetDescription
  models: IMindsetModels
  generatedAt: number
}

/**
 * Process-global cache of loaded mindsets, keyed by mindset class. Used by
 * `MindsetOperator` when a mindset opts in via `@mindset({ cache })` so its
 * `describe()` + `models()` run once and are reused across chats/messages
 * instead of on every model round-trip.
 *
 * Inject it to invalidate on demand after the persona's inputs change:
 *
 * ```ts
 * constructor(private mindsets: MindsetCache) {}
 * this.mindsets.invalidate(EliaMindset) // next use recomputes
 * ```
 */
@singleton()
export class MindsetCache {
  private readonly entries = new Map<Function, ILoadedMindset>()

  get(mindsetClass: Function): ILoadedMindset | undefined {
    return this.entries.get(mindsetClass)
  }

  set(mindsetClass: Function, loaded: ILoadedMindset): void {
    this.entries.set(mindsetClass, loaded)
  }

  /** Drop the cached description for one mindset class; next use recomputes. */
  invalidate(mindsetClass: Function): void {
    this.entries.delete(mindsetClass)
  }

  /** Drop every cached mindset description. */
  invalidateAll(): void {
    this.entries.clear()
  }

  /** The mindset classes currently cached. */
  cachedClasses(): Function[] {
    return [...this.entries.keys()]
  }
}
