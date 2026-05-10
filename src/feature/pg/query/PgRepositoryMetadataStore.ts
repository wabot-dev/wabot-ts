import { singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { Entity, IEntityData } from '@/core/entity'
import { IPgRepositoryConfig } from '../IPgRepositoryConfig'

export interface IQueryMethodMetadata {
  repositoryConstructor: IConstructor<any>
  functionName: string
}

@singleton()
export class PgRepositoryMetadataStore {
  private queryMethods = new Map<Function, Map<string, IQueryMethodMetadata>>()
  private repositoryConfigs = new Map<Function, IPgRepositoryConfig<any>>()

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
    config: IPgRepositoryConfig<P>,
  ) {
    this.repositoryConfigs.set(ctor, config)
  }

  getRepositoryConfig(ctor: IConstructor<any>): IPgRepositoryConfig<any> | undefined {
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
}
