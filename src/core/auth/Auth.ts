import { IStorableData } from '@/core/storable'
import { CustomError } from '@/core/error'
import { Lifecycle, scoped } from '@/core/injection'

@scoped(Lifecycle.ContainerScoped)
export class Auth<D extends IStorableData> {
  private authInfo: D | null = null

  require(): D {
    if (!this.authInfo) {
      throw new CustomError({ message: 'Unauthorized', httpCode: 401 })
    }
    return this.authInfo
  }

  assign(authInfo: D): void {
    if (this.authInfo) {
      throw new CustomError({ message: 'Authorization info already assigned', httpCode: 401 })
    }
    this.authInfo = authInfo
  }

  override(authInfo: D): void {
    this.authInfo = authInfo
  }

  clear(): void {
    this.authInfo = null
  }

  isAssigned(): boolean {
    return this.authInfo !== null
  }
}
