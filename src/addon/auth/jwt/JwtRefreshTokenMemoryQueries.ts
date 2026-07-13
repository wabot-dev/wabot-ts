import { memExtension, MemoryRepositoryExtension } from '@/feature/repository'
import { IJwtRefreshTokenQueries } from './IJwtRefreshTokenQueries'
import { JwtRefreshToken } from './JwtRefreshToken'
import { JwtRefreshTokenRepository } from './JwtRefreshTokenRepository'

/**
 * In-memory implementation of {@link JwtRefreshTokenRepository}'s custom
 * queries. Ships with the framework and registers itself on import.
 */
@memExtension(JwtRefreshTokenRepository)
export class JwtRefreshTokenMemoryQueries
  extends MemoryRepositoryExtension<JwtRefreshToken<any>>
  implements IJwtRefreshTokenQueries<any>
{
  async findByMetadata(metadata: Record<string, string>): Promise<JwtRefreshToken<any>[]> {
    return [...this.items.values()]
      .map((token) => this.clone(token))
      .filter((token) => Object.entries(metadata).every(([k, v]) => token.metadata[k] === v))
  }
}
