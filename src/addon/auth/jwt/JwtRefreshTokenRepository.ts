import { IStorableData } from '@/core/storable'
import { IJwtRefreshTokenRepository } from './IJwtRefreshTokenRepository'
import { JwtRefreshToken } from './JwtRefreshToken'

export class JwtRefreshTokenRepository<D extends IStorableData>
  implements IJwtRefreshTokenRepository<D>
{
  findByMetadata(metadata: Record<string, string>): Promise<JwtRefreshToken<D>[]> {
    throw new Error('Method not implemented.')
  }
  findAndValidate(secret: string): Promise<D> {
    throw new Error('Method not implemented.')
  }
  find(id: string): Promise<JwtRefreshToken<D> | null> {
    throw new Error('Method not implemented.')
  }
  findOrThrow(id: string): Promise<JwtRefreshToken<D>> {
    throw new Error('Method not implemented.')
  }
  findByIds(ids: string[]): Promise<JwtRefreshToken<D>[]> {
    throw new Error('Method not implemented.')
  }
  findAll(id: string): Promise<JwtRefreshToken<D>[]> {
    throw new Error('Method not implemented.')
  }
  create(item: JwtRefreshToken<D>): Promise<void> {
    throw new Error('Method not implemented.')
  }
  update(item: JwtRefreshToken<D>): Promise<void> {
    throw new Error('Method not implemented.')
  }
  delete(item: JwtRefreshToken<D>): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
