export interface IMindset {
  identity(): Promise<string>;
  personality(): Promise<string>;
  skills(): Promise<string>;
  emotions?(): Promise<string>;
  attitudes?(): Promise<string>;
  limits?(): Promise<string>;
}