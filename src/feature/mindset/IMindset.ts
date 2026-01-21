export interface IMindsetIdentity {
  name: string
  language: string
  personality?: string
  emotions?: string
}

export interface IMindsetLlm {
  provider?: string
  model: string
}

export interface IMindset {
  context(): Promise<string>
  identity(): Promise<IMindsetIdentity>
  skills(): Promise<string>
  limits(): Promise<string>
  workflow(): Promise<string>
  llms(): Promise<IMindsetLlm[]>
}

export class Mindset implements IMindset {
  context(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  identity(): Promise<IMindsetIdentity> {
    throw new Error('Method not implemented.')
  }
  skills(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  limits(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  workflow(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  llms(): Promise<IMindsetLlm[]> {
    throw new Error('Method not implemented.')
  }
}
