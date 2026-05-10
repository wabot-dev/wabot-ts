import { singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IChatAdapter } from '../IChatAdapter'
import { IChatAdapterMetadata } from './IChatAdapterMetadata'

@singleton()
export class ChatAdapterMetadataStore {
  private adapters = new Map<Function, IChatAdapterMetadata>()

  save(metadata: IChatAdapterMetadata) {
    this.adapters.set(metadata.constructor, metadata)
  }

  get(ctor: IConstructor<IChatAdapter>): IChatAdapterMetadata | undefined {
    return this.adapters.get(ctor)
  }
}
