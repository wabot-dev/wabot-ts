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

/**
 * The mindset's persona, returned by {@link IMindset.describe} in a single call.
 * `identity` stays structured (the framework reads `name`/`language`); the rest
 * are the labeled prompt sections the framework composes into the system prompt.
 */
export interface IMindsetDescription {
  identity: IMindsetIdentity
  context: string
  skills: string
  limits: string
  workflow: string
}

export interface IMindset {
  /** The persona/instructions of the mindset (identity + prompt sections). */
  describe(): Promise<IMindsetDescription>
  /** Models the mindset may use, by kind. */
  models(): Promise<IMindsetModels>
}

/** DI token + throw-everything base, mirroring {@link Agent}. */
export class Mindset implements IMindset {
  describe(): Promise<IMindsetDescription> {
    throw new Error('Method not implemented.')
  }
  models(): Promise<IMindsetModels> {
    throw new Error('Method not implemented.')
  }
}
