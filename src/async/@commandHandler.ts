
import { IConstructor } from '@/core'
import { Command } from './Command'
import { CommandMetadataStore } from './CommandMetadataStore'
import { ICommandHandler } from './ICommandHandler'
import { container, injectable } from '@/injection'

export interface ICommandHandlerConfig<C extends Command<any>> {
  command: IConstructor<C>
}

export function commandHandler<C extends Command<any>>(config: ICommandHandlerConfig<C>) {
  return function (target: IConstructor<ICommandHandler<C>>) {
    const handlerContainer = container.resolve(CommandMetadataStore)
    handlerContainer.registerHandler(config.command, target)
    injectable()(target)
  }
}
