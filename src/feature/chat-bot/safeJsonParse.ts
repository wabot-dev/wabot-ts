import { CustomError } from '@/core/error'

export function safeJsonParse<T = unknown>(json: string | undefined | null, context?: string): T {
  const input = json || '{}'
  try {
    return JSON.parse(input) as T
  } catch (error) {
    throw new CustomError({
      message: `Failed to parse JSON${context ? ` in ${context}` : ''}: ${input}`,
      code: 'JSON_PARSE_ERROR',
      httpCode: 400,
      cause: error instanceof Error ? error : undefined,
    })
  }
}
