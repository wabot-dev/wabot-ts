import { Command } from "./Command";


export interface ICommandHandler<C extends Command<any>> {
  handle(command: C): void | Promise<void>
}
