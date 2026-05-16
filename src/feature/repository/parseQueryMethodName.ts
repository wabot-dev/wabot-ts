import {
  IQueryAst,
  IQueryCondition,
  IQueryOrderBy,
  QueryConnector,
  QueryOperator,
  QueryPrefix,
} from './types'

const PREFIXES: QueryPrefix[] = ['findOne', 'find', 'count', 'exists', 'delete']

const OPERATOR_MATCHERS: { tokens: string[]; op: QueryOperator }[] = [
  { tokens: ['Greater', 'Than', 'Equal'], op: 'Gte' },
  { tokens: ['Less', 'Than', 'Equal'], op: 'Lte' },
  { tokens: ['Greater', 'Than'], op: 'Gt' },
  { tokens: ['Less', 'Than'], op: 'Lt' },
  { tokens: ['Is', 'Not', 'Null'], op: 'IsNotNull' },
  { tokens: ['Is', 'Null'], op: 'IsNull' },
  { tokens: ['Not', 'Like'], op: 'NotLike' },
  { tokens: ['Not', 'In'], op: 'NotIn' },
  { tokens: ['Like'], op: 'Like' },
  { tokens: ['In'], op: 'In' },
  { tokens: ['Not'], op: 'Not' },
  { tokens: ['Gte'], op: 'Gte' },
  { tokens: ['Lte'], op: 'Lte' },
  { tokens: ['Gt'], op: 'Gt' },
  { tokens: ['Lt'], op: 'Lt' },
]

const CONNECTOR_TOKENS = new Set(['And', 'Or'])

const FIELD_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/

function splitCamelCase(s: string): string[] {
  return s.match(/[A-Z][a-z0-9]*/g) ?? []
}

function tokensToFieldName(tokens: string[]): string {
  if (tokens.length === 0) {
    throw new Error('Query method: missing field name')
  }
  const joined = tokens.join('')
  const field = joined.charAt(0).toLowerCase() + joined.slice(1)
  if (!FIELD_NAME_REGEX.test(field)) {
    throw new Error(`Query method: invalid field name "${field}"`)
  }
  return field
}

function matchPrefix(name: string): { prefix: QueryPrefix; rest: string } {
  for (const prefix of PREFIXES) {
    if (name.startsWith(prefix)) {
      const next = name.charAt(prefix.length)
      if (next === '' || (next >= 'A' && next <= 'Z')) {
        return { prefix, rest: name.slice(prefix.length) }
      }
    }
  }
  throw new Error(`Query method "${name}" must start with one of: ${PREFIXES.join(', ')}`)
}

function parseConditionTokens(tokens: string[]): { field: string; operator: QueryOperator } {
  for (const matcher of OPERATOR_MATCHERS) {
    if (tokens.length < matcher.tokens.length) continue
    const tail = tokens.slice(tokens.length - matcher.tokens.length)
    if (tail.every((t, i) => t === matcher.tokens[i])) {
      const head = tokens.slice(0, tokens.length - matcher.tokens.length)
      return { field: tokensToFieldName(head), operator: matcher.op }
    }
  }
  return { field: tokensToFieldName(tokens), operator: 'Equals' }
}

function parseConditions(body: string): IQueryCondition[] {
  if (body === '') return []
  const tokens = splitCamelCase(body)
  if (tokens.length === 0) return []
  if (CONNECTOR_TOKENS.has(tokens[0])) {
    throw new Error(`Query method: condition cannot start with connector "${tokens[0]}"`)
  }

  const conditions: IQueryCondition[] = []
  let buffer: string[] = []
  let pendingConnector: QueryConnector | undefined

  const flush = () => {
    if (buffer.length === 0) {
      throw new Error('Query method: empty condition between connectors')
    }
    const { field, operator } = parseConditionTokens(buffer)
    conditions.push({ field, operator, connector: pendingConnector })
    buffer = []
  }

  for (const token of tokens) {
    if (CONNECTOR_TOKENS.has(token) && buffer.length > 0) {
      flush()
      pendingConnector = token as QueryConnector
    } else {
      buffer.push(token)
    }
  }
  flush()
  return conditions
}

function parseOrderBy(body: string): IQueryOrderBy[] {
  const tokens = splitCamelCase(body)
  const result: IQueryOrderBy[] = []
  let buffer: string[] = []

  for (const token of tokens) {
    if (token === 'Asc' || token === 'Desc') {
      if (buffer.length === 0) {
        throw new Error('Query method: OrderBy direction without field')
      }
      result.push({
        field: tokensToFieldName(buffer),
        direction: token === 'Asc' ? 'ASC' : 'DESC',
      })
      buffer = []
    } else {
      buffer.push(token)
    }
  }

  if (buffer.length > 0) {
    throw new Error(
      `Query method: OrderBy field "${tokensToFieldName(buffer)}" missing Asc/Desc direction`,
    )
  }
  if (result.length === 0) {
    throw new Error('Query method: OrderBy clause has no fields')
  }
  return result
}

// Conditions are joined left-to-right; the DSL has no parentheses,
// so SQL precedence applies (AND binds tighter than OR). Group with
// explicit method names if the implicit precedence is not what you want.
export function parseQueryMethodName(name: string): IQueryAst {
  const { prefix, rest: afterPrefix } = matchPrefix(name)
  let rest = afterPrefix

  let limit: number | undefined
  const limitMatch = rest.match(/Limit(\d+)$/)
  if (limitMatch) {
    if (prefix === 'findOne') {
      throw new Error(`Query method "${name}": findOne implies LIMIT 1; remove the Limit suffix`)
    }
    limit = parseInt(limitMatch[1], 10)
    rest = rest.slice(0, rest.length - limitMatch[0].length)
  }

  let orderBy: IQueryOrderBy[] = []
  const orderByIdx = rest.indexOf('OrderBy')
  if (orderByIdx >= 0) {
    orderBy = parseOrderBy(rest.slice(orderByIdx + 'OrderBy'.length))
    rest = rest.slice(0, orderByIdx)
  }

  let conditions: IQueryCondition[] = []
  if (rest === '' || rest === 'All') {
    conditions = []
  } else if (rest.startsWith('By')) {
    conditions = parseConditions(rest.slice(2))
  } else {
    throw new Error(
      `Query method "${name}": expected "By<...>" or "All" after prefix, got "${rest}"`,
    )
  }

  return { prefix, conditions, orderBy, limit }
}
