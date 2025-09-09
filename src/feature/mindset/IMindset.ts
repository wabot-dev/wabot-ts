export interface IMindsetIdentity {
  name: string
  language: string
  age?: number
  personality?: string
  emotions?: string
}

export interface IMindsetLlm {
  provider?: string
  model: string
}

export interface IMindset {
  identity(): Promise<IMindsetIdentity>
  skills(): Promise<string>
  limits(): Promise<string>
  llms(): Promise<IMindsetLlm[]>
}

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
  llms(): Promise<IMindsetLlm[]> {
    throw new Error('Method not implemented.')
  }
}
