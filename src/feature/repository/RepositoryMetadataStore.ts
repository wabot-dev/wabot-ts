import { singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { Entity, IEntityData } from '@/core/entity'
import { IRepositoryConfig } from './IRepositoryConfig'

export interface IQueryMethodMetadata {
  repositoryConstructor: IConstructor<any>
  functionName: string
}

@singleton()
export class RepositoryMetadataStore {
  private queryMethods = new Map<Function, Map<string, IQueryMethodMetadata>>()
  private repositoryConfigs = new Map<Function, IRepositoryConfig<any>>()
  private extensions = new Map<Function, Map<symbol, IConstructor<any>>>()

  saveQueryMethodMetadata(metadata: IQueryMethodMetadata) {
    let perClass = this.queryMethods.get(metadata.repositoryConstructor)
    if (!perClass) {
      perClass = new Map()
      this.queryMethods.set(metadata.repositoryConstructor, perClass)
    }
    perClass.set(metadata.functionName, metadata)
  }

  saveRepositoryConfig<P extends Entity<IEntityData>>(
    ctor: IConstructor<any>,
    config: IRepositoryConfig<P>,
  ) {
    this.repositoryConfigs.set(ctor, config)
  }

  getRepositoryConfig(ctor: IConstructor<any>): IRepositoryConfig<any> | undefined {
    return this.repositoryConfigs.get(ctor)
  }

  getQueryMethods(ctor: IConstructor<any>): IQueryMethodMetadata[] {
    const collected = new Map<string, IQueryMethodMetadata>()
    const hierarchy: Function[] = []
    let proto: any = ctor.prototype
    while (proto && proto.constructor !== Object) {
      hierarchy.unshift(proto.constructor)
      proto = Object.getPrototypeOf(proto)
    }
    for (const cls of hierarchy) {
      const perClass = this.queryMethods.get(cls)
      if (perClass) {
        for (const [name, meta] of perClass) {
          collected.set(name, meta)
        }
      }
    }
    return [...collected.values()]
  }

  saveExtension(
    repositoryConstructor: IConstructor<any>,
    adapterId: symbol,
    extensionConstructor: IConstructor<any>,
  ): void {
    let perRepo = this.extensions.get(repositoryConstructor)
    if (!perRepo) {
      perRepo = new Map()
      this.extensions.set(repositoryConstructor, perRepo)
    }
    const existing = perRepo.get(adapterId)
    if (existing && existing !== extensionConstructor) {
      throw new Error(
        `Extension conflict on ${repositoryConstructor.name}: ` +
          `adapter "${adapterId.description ?? 'unknown'}" already has ` +
          `extension ${existing.name}; cannot register ${extensionConstructor.name}.`,
      )
    }
    perRepo.set(adapterId, extensionConstructor)
  }

  getExtension(
    ctor: IConstructor<any>,
    adapterId: symbol,
  ): IConstructor<any> | undefined {
    let proto: any = ctor.prototype
    while (proto && proto.constructor !== Object) {
      const perRepo = this.extensions.get(proto.constructor)
      if (perRepo) {
        const ext = perRepo.get(adapterId)
        if (ext) return ext
      }
      proto = Object.getPrototypeOf(proto)
    }
    return undefined
  }
}
