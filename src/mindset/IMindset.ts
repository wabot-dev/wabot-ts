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
