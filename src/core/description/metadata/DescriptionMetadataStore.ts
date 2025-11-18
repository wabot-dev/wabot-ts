import { IConstructor } from '@/core/generics'
import { IDescriptionMetadata } from './IDescriptionMetadata'

export class DescriptionMetadataStore {
  private descriptions = new Map<Function, IDescriptionMetadata[]>()

  saveDescriptionMetadata(metadata: IDescriptionMetadata) {
    let ctorDescriptions = this.descriptions.get(metadata.constructor)
    if (!ctorDescriptions) {
      this.descriptions.set(metadata.constructor, (ctorDescriptions = []))
    }
    ctorDescriptions.unshift(metadata)
  }

  getModelDescriptions(model: IConstructor<any>) {
    return this.descriptions.get(model) ?? []
  }
}
