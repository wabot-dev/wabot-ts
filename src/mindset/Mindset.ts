import { IMindset, IMindsetIdentity } from './IMindset'

export class Mindset implements IMindset {
  identity(): Promise<IMindsetIdentity> {
    throw new Error('Method not implemented.')
  }

  skills(): Promise<string> {
    throw new Error('Method not implemented.')
  }
 
  limits(): Promise<string> {
    throw new Error('Method not implemented.')
  }

  callFunction(functionName: string, parameters: Record<string, any>): Promise<string> {
    throw new Error('Method not implemented.')
  }
}
