export interface IActionConfig {
  /** Sub-path of the action. Defaults to the method name. Mounted under `<controller>/_action/<path>`. */
  path?: string
}
