import { singleton } from '@/core/injection'

import { type IMindsetModuleMetadata } from './modules/IMindsetModuleMetadata'

import { type IMindsetMetadata } from './mindsets/IMindsetMetadata'
import { mindsetToolClasses } from './mindsets/IMindsetConfig'
import { IConstructor } from '@/core/generics'
import { IMindset } from '../IMindset'
import { ToolMetadataStore } from '@/feature/tool'

@singleton()
export class MindsetMetadataStore {
  private readonly mindsets = new Map<Function, IMindsetMetadata>()

  constructor(private toolMetadataStore: ToolMetadataStore) {}

  /** @deprecated register tools with `@tools`. Delegates to {@link ToolMetadataStore}. */
  public saveModuleMetadata(metadata: IMindsetModuleMetadata): void {
    this.toolMetadataStore.saveToolMetadata(metadata)
  }

  public saveMindsetMetadata(metadata: IMindsetMetadata): void {
    this.mindsets.set(metadata.constructor, metadata)
  }

  public getModuleInfo(moduleCtor: IConstructor<any>) {
    return this.toolMetadataStore.getToolClassInfo(moduleCtor)
  }

  public getMindsetInfo(mindsetCtor: IConstructor<IMindset>) {
    const mindset = this.mindsets.get(mindsetCtor)
    if (!mindset) {
      throw new Error(`not found mindset info for ${mindsetCtor.name}`)
    }
    return {
      config: mindset.config,
      modules: mindsetToolClasses(mindset.config).map((x) => this.getModuleInfo(x)),
    }
  }
}
