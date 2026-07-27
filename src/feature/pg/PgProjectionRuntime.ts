import { Pool } from 'pg'

import { CustomError } from '@/core/error'
import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { validateModel, ValidationMetadataStore } from '@/core/validation'
import { IProjectionRuntime } from '@/feature/repository'
import { withPgClient } from './withPgClient'

/**
 * The driver answers with what the wire gives it: `numeric`, `bigint` and
 * `count(*)` all arrive as strings, and dates as `Date`. A projection row
 * declares what it wants through its validators, so the declared type is what
 * decides how a raw value is read — otherwise a summed total would be text
 * pretending to be a number.
 */
function coerceToDeclared(value: unknown, type: string | undefined): unknown {
  if (value == null || type === undefined) return value
  switch (type) {
    case 'number':
      return typeof value === 'string' && value.trim() !== '' ? Number(value) : value
    case 'boolean':
      return typeof value === 'string' ? value === 't' || value === 'true' : value
    case 'date':
      return typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
    case 'string':
      return typeof value === 'string' ? value : String(value)
    default:
      return value
  }
}

/** Declared type per property of a row class, from its validation metadata. */
function declaredTypes(row: IConstructor<any>): Record<string, string | undefined> {
  const info = container.resolve(ValidationMetadataStore).getModelValidatorsInfo(row)
  const types: Record<string, string | undefined> = {}
  for (const [property, meta] of Object.entries(info.properties ?? {})) {
    types[property] = (meta as any)?.validators?.find(
      (validator: any) => validator?.typeDescriptor,
    )?.typeDescriptor
  }
  return types
}

/**
 * Runs a projection's statements on Postgres. Goes through `withPgClient`, so a
 * statement issued inside an open transaction on the same pool runs on that
 * transaction's connection and sees its uncommitted writes.
 */
export class PgProjectionRuntime implements IProjectionRuntime {
  constructor(private readonly pool: Pool) {}

  async query<T>(row: IConstructor<T>, sql: string, params: unknown[] = []): Promise<T[]> {
    const rows = await withPgClient(this.pool, async (client) => {
      const result = await client.query(sql, params as any[])
      return result.rows
    })

    const types = declaredTypes(row)
    const info = container.resolve(ValidationMetadataStore).getModelValidatorsInfo(row)

    return rows.map((raw, index) => {
      const coerced: Record<string, unknown> = {}
      for (const [column, value] of Object.entries(raw)) {
        coerced[column] = coerceToDeclared(value, types[column])
      }
      const { value, error } = validateModel(coerced, info)
      if (error) {
        throw new CustomError({
          httpCode: 500,
          message: `${row.name}: row ${index} does not match the projection's declared shape`,
          info: error,
        })
      }
      return value as T
    })
  }
}
