export interface IToolsConfig {
  /** Language the tool descriptions are written in. Defaults to `english`. */
  language?: string
  /**
   * Whether this tool set is visible to mindsets (end-user chatbots).
   * Defaults to `true`. Set to `false` for agent-only / privileged tools:
   * a mindset delegating to an agent can never reach them unless the
   * delegation explicitly allow-lists the tool.
   */
  exposeToMindsets?: boolean
}
