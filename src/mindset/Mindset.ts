import { IMindset } from './IMindset'

export class Mindset implements IMindset {
  identity(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  personality(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  skills(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  emotions?(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  attitudes?(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  limits?(): Promise<string> {
    throw new Error('Method not implemented.')
  }

  callFunction(functionName: string, parameters: Record<string, any>): Promise<string> {
    throw new Error('Method not implemented.')
  }
}
