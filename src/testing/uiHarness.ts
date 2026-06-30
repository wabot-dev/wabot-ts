import { Server } from 'node:http'

import { IConstructor } from '@/core/generics'
import { container, Container, DependencyContainer } from '@/core/injection'
import { ExpressProvider } from '@/feature/express'
import { HttpServerProvider } from '@/feature/http'
import { registerUiControllers, UiRendererRegistry } from '@/feature/ui-controller'
import { PreactRenderer } from '@/addon/ui/preact'

export interface IUiHarnessOptions {
  controllers: IConstructor<any>[]
  /** Extra DI registrations visible to middlewares and controllers: [token, instance]. */
  register?: [any, any][]
}

export interface IUiRequestOptions {
  body?: unknown
  headers?: Record<string, string>
  query?: Record<string, string>
  /** Follow redirects ("follow", default) or capture them ("manual"). */
  redirect?: 'follow' | 'manual'
}

export interface IUiResponse {
  status: number
  /** Raw response body. */
  text: string
  headers: Headers
  /** Parse the body as JSON (for @action responses). */
  json(): any
}

/**
 * Mounts @uiController classes on a private HTTP server (ephemeral port) and
 * exercises the real pipeline: middlewares/guards, validation, SSR and actions.
 * Islands render as static SSR HTML (no client bundling needed for tests).
 */
export class UiHarness {
  readonly container: DependencyContainer

  private server: Server
  private baseUrl = ''

  private constructor(options: IUiHarnessOptions) {
    const child = container.createChildContainer()
    child.register(Container, { useValue: child })

    for (const [token, instance] of options.register ?? []) {
      child.registerInstance(token, instance)
    }

    const rendererRegistry = child.resolve(UiRendererRegistry)
    if (!rendererRegistry.hasDefault()) {
      rendererRegistry.setDefault(new PreactRenderer())
    }

    this.container = child

    const httpServerProvider = new HttpServerProvider()
    const expressProvider = new ExpressProvider(httpServerProvider)
    registerUiControllers(options.controllers, { baseContainer: child, expressProvider })
    this.server = httpServerProvider.getHttpServer()
  }

  static async create(options: IUiHarnessOptions): Promise<UiHarness> {
    const harness = new UiHarness(options)
    await harness.listen()
    return harness
  }

  private listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server.address()
        if (!address || typeof address === 'string') {
          reject(new Error('UiHarness: could not determine server port'))
          return
        }
        this.baseUrl = `http://127.0.0.1:${address.port}`
        resolve()
      })
    })
  }

  get url(): string {
    return this.baseUrl
  }

  /** GET a view; returns the rendered HTML document. */
  get(path: string, options: IUiRequestOptions = {}): Promise<IUiResponse> {
    return this.request('GET', path, options)
  }

  /** POST to an @action route (e.g. "/my/ui/_action/addTodo"). */
  action(path: string, body?: unknown, options: IUiRequestOptions = {}): Promise<IUiResponse> {
    return this.request('POST', path, { ...options, body })
  }

  async request(
    method: string,
    path: string,
    options: IUiRequestOptions = {},
  ): Promise<IUiResponse> {
    const url = new URL(path, this.baseUrl)
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value)
    }

    const headers: Record<string, string> = { ...options.headers }
    let body: string | undefined
    if (options.body !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
      body = JSON.stringify(options.body)
    }

    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body,
      redirect: options.redirect ?? 'follow',
    })
    const text = await response.text()
    return {
      status: response.status,
      text,
      headers: response.headers,
      json: () => (text ? JSON.parse(text) : null),
    }
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()))
    })
  }
}

export function createUiHarness(options: IUiHarnessOptions): Promise<UiHarness> {
  return UiHarness.create(options)
}
