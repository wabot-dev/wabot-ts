export interface ITransactionAdapter {
  run<T>(fn: () => Promise<T>): Promise<T>
}
