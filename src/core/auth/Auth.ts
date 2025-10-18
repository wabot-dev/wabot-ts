import { IStorableData } from '@/core/storable'
import { CustomError } from '@/core/error'
import { Lifecycle, scoped } from '@/core/injection'

@scoped(Lifecycle.ContainerScoped)
export class Auth<D extends IStorableData> {
  private authInfo: D | null = null
  private overrided = false

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
    this.overrided = true
  }

  clear(): void {
    this.authInfo = null
    this.overrided = true
  }

  isAssigned(): boolean {
    return this.authInfo !== null
  }

  wasOverrided(): boolean {
    return this.overrided
  }
}
