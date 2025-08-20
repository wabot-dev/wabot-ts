import { IStorableData } from "@/core"
import { CustomError } from "@/error"
import { Lifecycle, scoped } from "@/injection"


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
}
