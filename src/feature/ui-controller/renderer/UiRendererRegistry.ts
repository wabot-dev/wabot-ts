import { singleton } from '@/core/injection'
import { UiRenderer } from './UiRenderer'

@singleton()
export class UiRendererRegistry {
  private renderers = new Map<string, UiRenderer>()
  private defaultRenderer: UiRenderer | null = null

  /** Register a renderer. The first one registered becomes the default. */
  register(renderer: UiRenderer): void {
    this.renderers.set(renderer.id, renderer)
    if (!this.defaultRenderer) this.defaultRenderer = renderer
  }

  /** Register a renderer and make it the default. */
  setDefault(renderer: UiRenderer): void {
    this.renderers.set(renderer.id, renderer)
    this.defaultRenderer = renderer
  }

  has(id: string): boolean {
    return this.renderers.has(id)
  }

  hasDefault(): boolean {
    return this.defaultRenderer != null
  }

  get(id?: string): UiRenderer {
    if (id) {
      const renderer = this.renderers.get(id)
      if (!renderer) {
        throw new Error(`UI renderer "${id}" is not registered`)
      }
      return renderer
    }
    if (!this.defaultRenderer) {
      throw new Error(
        'No default UI renderer registered. Import "@wabot-dev/framework/ui" to register the Preact renderer, or register your own with UiRendererRegistry.setDefault().',
      )
    }
    return this.defaultRenderer
  }
}
