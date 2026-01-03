import { CustomError } from '@/core/error'
import { Lifecycle, scoped } from '@/core/injection'
import { IStorableType } from '../storable/IStorableType'

@scoped(Lifecycle.ContainerScoped)
export class Auth<D> {
  private authInfo: IStorableType<D> | null = null
  private overrided = false

  require(): IStorableType<D> {
    if (!this.authInfo) {
      throw new CustomError({ message: 'Unauthorized', httpCode: 401 })
    }
    return this.authInfo
  }

  assign(authInfo: IStorableType<D>): void {
    if (this.authInfo) {
      throw new CustomError({ message: 'Authorization info already assigned', httpCode: 401 })
    }
    this.authInfo = authInfo
  }

  override(authInfo: IStorableType<D>): void {
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
