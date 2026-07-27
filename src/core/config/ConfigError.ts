/**
 * Thrown when a config reference (`str\`path\``, `num\`path\``, …) cannot be
 * resolved — the env var is missing (and no default) or its value fails to
 * coerce. Carries the config `path` and the resolved `envVar` so the project
 * runner can fail fast at startup with a complete, actionable list.
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    readonly path: string,
    readonly envVar: string,
  ) {
    super(message)
    this.name = 'ConfigError'
  }
}

/** Find a ConfigError in an unknown error or its `cause` chain, if any. */
export function findConfigError(error: unknown): ConfigError | undefined {
  let current: unknown = error
  for (let depth = 0; depth < 5 && current != null; depth++) {
    if (current instanceof ConfigError) return current
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

/** Build a single aggregated, deduplicated startup message from config errors. */
export function formatConfigErrorReport(errors: ConfigError[]): string {
  const unique = [...new Map(errors.map((e) => [e.envVar, e])).values()]
  const lines = unique.map((e) => `  - ${e.envVar} (config: ${e.path}): ${e.message}`)
  return `Configuration error at startup — set or fix these:\n${lines.join('\n')}`
}
