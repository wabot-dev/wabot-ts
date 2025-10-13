import { ICrudRepository } from '@/core/repository'
import { IStorableData } from '@/core/storable'
import { JwtRefreshToken } from './JwtRefreshToken'

export interface IJwtRefreshTokenRepository<D extends IStorableData>
  extends ICrudRepository<JwtRefreshToken<D>> {
  findAndValidate(secret: string): Promise<D>
  findByMetadata(metadata: Record<string, string>): Promise<JwtRefreshToken<D>[]>
}
