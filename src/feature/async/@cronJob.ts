import { IConstructor } from '@/core/generics'
import { CommandMetadataStore } from './CommandMetadataStore'
import { container } from '@/core/injection'
import { Command } from './Command'
import { IStorableData } from '@/core/storable'
import { ICommandHandler } from './ICommandHandler'

export interface ICronJobConfig<C extends Command<IStorableData>> {
  name: string
  cron: string
  commandData: C extends Command<infer D> ? D : never
  disabled?: boolean
}

export function cronJob<C extends Command<IStorableData>>(config: ICronJobConfig<C>) {
  return function (target: IConstructor<ICommandHandler<C>>) {
    const handlerContainer = container.resolve(CommandMetadataStore)
  }
}
