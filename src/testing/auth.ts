import jwt from 'jsonwebtoken'

import {
  ApiKey,
  ApiKeyRepository,
  IGenerateApiKeyReq,
  IGenerateApiKeyRes,
  JwtConfig,
} from '@/addon/auth'
import { CustomError } from '@/core/error'
import { IStorableType } from '@/core/storable/IStorableType'

export interface ITestJwtOptions {
  secret?: string
  accessExpirationSeconds?: number
  /** Origins allowed to authenticate a socket handshake with a cookie. */
  cookieAllowedOrigins?: string[]
}

export interface ITestSignOptions {
  /** `aud` claim to stamp on the signed token. */
  audience?: string
}

/**
 * JWT setup for tests: a JwtConfig with a test secret (no JWT_SECRET env var
 * needed) plus a signer, so the real JwtGuardMiddleware validates the tokens.
 */
export class TestJwt {
  readonly config: JwtConfig

  constructor(options: ITestJwtOptions = {}) {
    const config = Object.create(JwtConfig.prototype) as JwtConfig
    config.algorithm = 'HS256'
    config.secretOrPublicKey = options.secret ?? 'wabot-test-jwt-secret'
    config.secretOrPrivateKey = options.secret ?? 'wabot-test-jwt-secret'
    config.accessExpirationSeconds = options.accessExpirationSeconds ?? 10 * 60
    config.refreshExpirationSeconds = 365 * 24 * 3600
    config.cookieName = 'wabot_jwt'
    config.cookieAllowedOrigins = options.cookieAllowedOrigins ?? []
    this.config = config
  }

  /**
   * Sign a valid access token carrying the given authInfo. Pass `audience` to
   * stamp the `aud` claim `@jwtGuard({ audience })` checks.
   */
  sign(authInfo: object, options: ITestSignOptions = {}): string {
    return jwt.sign(authInfo, this.config.secretOrPrivateKey, {
      algorithm: this.config.algorithm,
      expiresIn: this.config.accessExpirationSeconds,
      ...(options.audience ? { audience: options.audience } : {}),
    })
  }

  /** A token signed with a different secret; useful for 401 tests. */
  signInvalid(authInfo: object = {}): string {
    return jwt.sign(authInfo, `${this.config.secretOrPrivateKey}-corrupted`, {
      algorithm: this.config.algorithm,
      expiresIn: this.config.accessExpirationSeconds,
    })
  }
}

export function setupTestJwt(options: ITestJwtOptions = {}): TestJwt {
  return new TestJwt(options)
}

/**
 * In-RAM IApiKeyRepository so the real ApiKeyGuardMiddleware can run in
 * tests. Register it with: register: [[ApiKeyRepository, testApiKeys]].
 */
export class TestApiKeyRepository<A extends object> extends ApiKeyRepository<A> {
  private items: ApiKey<A>[] = []
  private idCounter = 0

  /** Create a key for the given authInfo and return its secret. */
  async addKey(authInfo: IStorableType<A>, name = 'test-key'): Promise<string> {
    const { secret } = await this.generate({ name, authInfo })
    return secret
  }

  override async find(id: string): Promise<ApiKey<A> | null> {
    return this.items.find((item) => item.id === id) ?? null
  }

  override async findOrThrow(id: string): Promise<ApiKey<A>> {
    const item = await this.find(id)
    if (!item) {
      throw new CustomError({ message: `Not found ApiKey with id = '${id}'`, httpCode: 404 })
    }
    return item
  }

  // Declared as a property to match the base's @queryExtension declaration.
  override findByMetadata = async (metadata: Record<string, string>): Promise<ApiKey<A>[]> => {
    return this.items.filter((item) =>
      Object.entries(metadata).every(([key, value]) => item.metadata[key] === value),
    )
  }

  override async create(item: ApiKey<A>): Promise<void> {
    if (!item.wasCreated()) {
      item['data'].id = `test-api-key-${++this.idCounter}`
      item['data'].createdAt = Date.now()
    }
    this.items.push(item)
  }

  override async generate(req: IGenerateApiKeyReq<A>): Promise<IGenerateApiKeyRes<A>> {
    const apiKey = new ApiKey<A>({ name: req.name, metadata: req.metadata, authInfo: req.authInfo })
    const secret = apiKey.generateSecret()
    await this.create(apiKey)
    return { apiKey, secret }
  }

  override async findBySecret(secret: string): Promise<ApiKey<A> | null> {
    return this.items.find((item) => item.isValidSecret(secret)) ?? null
  }

  override async findAndValidate(secret: string): Promise<IStorableType<A>> {
    const apiKey = await this.findBySecret(secret)
    if (!apiKey) {
      throw new CustomError({ message: 'Invalid API key', httpCode: 401 })
    }
    return apiKey.authInfo as IStorableType<A>
  }
}
