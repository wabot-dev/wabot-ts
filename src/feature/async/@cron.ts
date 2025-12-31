import { IConstructor } from '@/core/generics'
import { CommandMetadataStore } from './CommandMetadataStore'
import { container } from '@/core/injection'
import { ICronHandler } from './ICronHandler'

export interface ICronConfig {
  name: string
  cron: string
  disabled?: boolean
}

export function cron(config: ICronConfig) {
  return function (target: IConstructor<ICronHandler>) {
    const metadataStore = container.resolve(CommandMetadataStore)
  }
}
