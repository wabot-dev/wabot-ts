import { createHash } from 'node:crypto'

function canonicalize(value: any): string {
  if (value === undefined || value === null) return 'null'
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']'
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort()
  return (
    '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}'
  )
}

export function computeDedupKey(commandData: unknown): string {
  return createHash('sha256').update(canonicalize(commandData)).digest('hex')
}
