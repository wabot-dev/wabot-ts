export interface ICommandHandler<C extends object> {
  handle(command: C): void | Promise<void>
}
