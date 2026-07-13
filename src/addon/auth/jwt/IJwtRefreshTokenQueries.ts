import { JwtRefreshToken } from './JwtRefreshToken'

/**
 * Custom (non field-equality) queries for {@link JwtRefreshTokenRepository},
 * implemented once per adapter (in-memory + Postgres). Both implementations
 * ship with the framework, so apps get `findByMetadata` for free.
 */
export interface IJwtRefreshTokenQueries<D extends object> {
  /** Tokens whose metadata contains every given key/value pair. */
  findByMetadata(metadata: Record<string, string>): Promise<JwtRefreshToken<D>[]>
}
