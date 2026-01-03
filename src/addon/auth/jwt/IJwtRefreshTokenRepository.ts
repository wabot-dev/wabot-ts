import { ICrudRepository } from '@/core/repository'
import { JwtRefreshToken } from './JwtRefreshToken'
import { IStorableType } from '@/core/storable/IStorableType'

export interface IJwtRefreshTokenRepository<D extends object>
  extends ICrudRepository<JwtRefreshToken<D>> {
  findAndValidate(secret: string): Promise<IStorableType<D>>
  findByMetadata(metadata: Record<string, string>): Promise<JwtRefreshToken<D>[]>
}
