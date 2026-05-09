export interface IMindsetIdentity {
  name: string
  language: string
  personality?: string
  emotions?: string
}

/** @deprecated use {@link IMindsetModelRef} */
export interface IMindsetLlm {
  provider?: string
  model: string
}

export interface IMindsetModelRef {
  provider?: string
  model: string
}

export type IMindsetModelKind =
  | 'llm'
  | 'visionLlm'
  | 'audioLlm'
  | 'speechToText'
  | 'textToSpeech'
  | 'imageGen'
  | 'embedding'

export interface IMindsetModels {
  llm?: IMindsetModelRef[]
  visionLlm?: IMindsetModelRef[]
  audioLlm?: IMindsetModelRef[]
  speechToText?: IMindsetModelRef[]
  textToSpeech?: IMindsetModelRef[]
  imageGen?: IMindsetModelRef[]
  embedding?: IMindsetModelRef[]
}

export interface IMindset {
  context(): Promise<string>
  identity(): Promise<IMindsetIdentity>
  skills(): Promise<string>
  limits(): Promise<string>
  workflow(): Promise<string>
  models?(): Promise<IMindsetModels>
  /** @deprecated implement {@link IMindset.models} instead */
  llms?(): Promise<IMindsetLlm[]>
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
  models?(): Promise<IMindsetModels> {
    throw new Error('Method not implemented.')
  }
  /** @deprecated implement {@link Mindset.models} instead */
  llms?(): Promise<IMindsetLlm[]> {
    throw new Error('Method not implemented.')
  }
}
