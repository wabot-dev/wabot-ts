export interface IContext {
  getPersonId(): Promise<string | null>
}
