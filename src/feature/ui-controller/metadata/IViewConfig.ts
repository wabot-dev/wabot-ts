export interface IViewConfig {
  /** Sub-path appended to the controller path. Empty/omitted = controller index. */
  path?: string
  /** Document <title> for this page. */
  title?: string
  /** Extra <meta> tags rendered into the document head: name -> content. */
  meta?: Record<string, string>
}
