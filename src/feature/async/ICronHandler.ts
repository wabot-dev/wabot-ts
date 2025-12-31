export interface ICronHandler {
  handle(): void | Promise<void>

  handleError?(e: any): void | Promise<void>
}
