import { IToolsConfig } from './IToolsConfig'

export interface IToolMetadata {
  constructor: Function
  config?: IToolsConfig
}
