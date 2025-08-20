import { Entity, IEntityData, IStorableData } from '@/core'

export interface IJwtRefreshTokenData<A extends IStorableData> extends IEntityData {
  authInfo: A
}

export class JwtRefreshToken<A extends IStorableData> extends Entity<IJwtRefreshTokenData<A>> {
  get authInfo() {
    return this.data.authInfo
  }
}
