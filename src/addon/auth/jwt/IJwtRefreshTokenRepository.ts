import { ICrudRepository } from '@/core/repository'
import { IStorableData } from '@/core/storable'
import { JwtRefreshToken } from './JwtRefreshToken'

export interface IJwtRefreshTokenRepository<D extends IStorableData>
  extends ICrudRepository<JwtRefreshToken<D>> {}
