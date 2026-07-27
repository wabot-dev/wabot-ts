import { Server } from 'node:http'

import { JwtConfig } from '@/addon/auth'
import { IConstructor } from '@/core/generics'
import { container, Container, DependencyContainer } from '@/core/injection'
import { ExpressProvider } from '@/feature/express'
import { HttpServerProvider } from '@/feature/http'
import { registerRestControllers } from '@/feature/rest-controller'

import { setupTestJwt, TestJwt, ITestJwtOptions } from './auth'

export interface IRestHarnessOptions {
  controllers: IConstructor<any>[]
  /** Extra DI registrations visible to middlewares and controllers: [token, instance]. */
  register?: [any, any][]
  /** Enable JWT support: registers a test JwtConfig so @jwtGuard works. */
  jwt?: boolean | ITestJwtOptions
}

export interface IRestRequestOptions {
  body?: unknown
  headers?: Record<string, string>
  query?: Record<string, string>
}

export interface IRestAsOptions {
  /** Send the signed token in this cookie instead of the Authorization header. */
  cookie?: string
  /** Sign the token for this audience, for `@jwtGuard({ audience })`. */
  audience?: string
}

export interface IRestResponse {
  status: number
  body: any
  headers: Headers
}

/**
 * Mounts @restController classes on a private HTTP server (ephemeral port)
 * and exercises the real pipeline: parsers, middlewares/guards, validation
 * and error mapping.
 */
export class RestHarness {
  readonly container: DependencyContainer
  readonly jwt?: TestJwt

  private server: Server
  private baseUrl = ''

  private constructor(options: IRestHarnessOptions) {
    const child = container.createChildContainer()
    child.register(Container, { useValue: child })

    if (options.jwt) {
      this.jwt = setupTestJwt(options.jwt === true ? {} : options.jwt)
      child.registerInstance(JwtConfig, this.jwt.config)
    }

    for (const [token, instance] of options.register ?? []) {
      child.registerInstance(token, instance)
    }

    this.container = child

    const httpServerProvider = new HttpServerProvider()
    const expressProvider = new ExpressProvider(httpServerProvider)
    registerRestControllers(options.controllers, {
      baseContainer: child,
      expressProvider,
    })
    this.server = httpServerProvider.getHttpServer()
  }

  static async create(options: IRestHarnessOptions): Promise<RestHarness> {
    const harness = new RestHarness(options)
    await harness.listen()
    return harness
  }

  private listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server.address()
        if (!address || typeof address === 'string') {
          reject(new Error('RestHarness: could not determine server port'))
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

  async request(
    method: string,
    path: string,
    options: IRestRequestOptions = {},
  ): Promise<IRestResponse> {
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

    const response = await fetch(url, { method: method.toUpperCase(), headers, body })
    const text = await response.text()
    let parsed: any = text
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      // keep raw text when the response is not JSON
    }
    return { status: response.status, body: parsed, headers: response.headers }
  }

  /**
   * Client that sends every request with a freshly signed token for the given
   * authInfo (requires the jwt option). By default the token travels in the
   * `Authorization` header; pass `cookie` to send it in that cookie instead
   * and `audience` to stamp the `aud` claim, which is how you exercise
   * `@jwtGuard({ cookie, audience })`.
   */
  as(
    authInfo: object,
    options: IRestAsOptions = {},
  ): {
    request: (method: string, path: string, options?: IRestRequestOptions) => Promise<IRestResponse>
  } {
    const jwt = this.jwt
    if (!jwt) {
      throw new Error('RestHarness: enable the jwt option to use as(authInfo)')
    }
    return {
      request: (method, path, requestOptions = {}) => {
        const token = jwt.sign(authInfo, { audience: options.audience })
        const authHeaders: Record<string, string> = options.cookie
          ? { Cookie: `${options.cookie}=${token}` }
          : { Authorization: `Bearer ${token}` }
        return this.request(method, path, {
          ...requestOptions,
          headers: { ...authHeaders, ...requestOptions.headers },
        })
      },
    }
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()))
    })
  }
}

export function createRestHarness(options: IRestHarnessOptions): Promise<RestHarness> {
  return RestHarness.create(options)
}
