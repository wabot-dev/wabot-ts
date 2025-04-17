import { IContext } from './IContext'


export class Context {
  
  constructor(private data: IContext){}
  
  getUserId(): string {
    return this.data.userId
  }
}
