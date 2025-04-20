export interface IMindsetIdentity {
  name: string
  language: string
  age?: number
  personality?: string
  emotions?: string
}


export interface IMindset {
  identity(): Promise<IMindsetIdentity>
  skills(): Promise<string>
  limits(): Promise<string>
}

export class Mindset implements IMindset {
  identity(): Promise<IMindsetIdentity> {
    throw new Error("Method not implemented.")
  }
  skills(): Promise<string> {
    throw new Error("Method not implemented.")
  }
  limits(): Promise<string> {
    throw new Error("Method not implemented.")
  }
}
