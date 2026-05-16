export type QueryPrefix = 'find' | 'findOne' | 'count' | 'exists' | 'delete'

export type QueryOperator =
  | 'Equals'
  | 'Not'
  | 'Like'
  | 'NotLike'
  | 'In'
  | 'NotIn'
  | 'Gt'
  | 'Gte'
  | 'Lt'
  | 'Lte'
  | 'IsNull'
  | 'IsNotNull'

export type QueryConnector = 'And' | 'Or'

export interface IQueryCondition {
  field: string
  operator: QueryOperator
  connector?: QueryConnector
}

export interface IQueryOrderBy {
  field: string
  direction: 'ASC' | 'DESC'
}

export interface IQueryAst {
  prefix: QueryPrefix
  conditions: IQueryCondition[]
  orderBy: IQueryOrderBy[]
  limit?: number
}
