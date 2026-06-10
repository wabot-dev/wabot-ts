import { IConstructor } from '@/core/generics'
import { IValidateInputShape, IValidationError, validateAndTransform } from '@/core/validation'

export interface IValidationIssue {
  path: string
  message: string
}

export interface IValidationFixtureResult<T> {
  value?: T
  issues: IValidationIssue[]
}

function flattenValidationError(error: any, path = ''): IValidationIssue[] {
  const out: IValidationIssue[] = []
  if (!error) return out
  if (Array.isArray(error.items)) {
    error.items.forEach((itemErrors: any, idx: number) => {
      if (!itemErrors) return
      const itemPath = `${path}[${idx}]`
      const list = Array.isArray(itemErrors) ? itemErrors : [itemErrors]
      list.forEach((itemError: IValidationError) =>
        out.push(...flattenValidationError(itemError, itemPath)),
      )
    })
    if (out.length > 0) return out
  }
  if (error.properties && typeof error.properties === 'object') {
    for (const propName in error.properties) {
      const propErrors = error.properties[propName]
      const propPath = path ? `${path}.${propName}` : propName
      if (Array.isArray(propErrors)) {
        propErrors.forEach((propError: IValidationError) =>
          out.push(...flattenValidationError(propError, propPath)),
        )
      }
    }
    if (out.length > 0) return out
  }
  if (typeof error.description === 'string') {
    out.push({ path: path || '(root)', message: error.description })
  }
  return out
}

/** Validate data against a decorated model and get flattened issues. */
export function validateFixture<T>(
  modelConstructor: IConstructor<T>,
  data: unknown,
): IValidationFixtureResult<T> {
  const result = validateAndTransform(data as IValidateInputShape<T>, modelConstructor)
  if (result.error) {
    return { issues: flattenValidationError(result.error) }
  }
  return { value: result.value, issues: [] }
}

/** Assert the data is valid for the model; returns the transformed value. */
export function assertValid<T>(modelConstructor: IConstructor<T>, data: unknown): T {
  const { value, issues } = validateFixture(modelConstructor, data)
  if (issues.length > 0) {
    const detail = issues.map((issue) => `  ${issue.path}: ${issue.message}`).join('\n')
    throw new Error(`Expected ${modelConstructor.name} to be valid, but got:\n${detail}`)
  }
  return value as T
}

/** Assert the data is invalid; optionally that a specific path has an issue. */
export function assertInvalid<T>(
  modelConstructor: IConstructor<T>,
  data: unknown,
  options: { path?: string } = {},
): IValidationIssue[] {
  const { issues } = validateFixture(modelConstructor, data)
  if (issues.length === 0) {
    throw new Error(`Expected ${modelConstructor.name} to be invalid, but it passed validation`)
  }
  if (options.path && !issues.some((issue) => issue.path === options.path)) {
    const paths = issues.map((issue) => issue.path).join(', ')
    throw new Error(`Expected an issue at path '${options.path}', but issues were at: ${paths}`)
  }
  return issues
}
