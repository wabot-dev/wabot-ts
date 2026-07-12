import { isIn, isNotEmpty, isOptional, isString } from '@/core/validation'

/**
 * Query-param DTOs for the monitor list views. Query params arrive as strings,
 * so page/limit are validated as strings and parsed in the handler. Every field
 * is `@isOptional()` so absent filters don't fail validation.
 */

export class ListChatsQuery {
  @isOptional()
  @isString()
  channel?: string

  @isOptional()
  @isIn(['PRIVATE', 'GROUP'])
  type?: string

  @isOptional()
  @isString()
  q?: string

  @isOptional()
  @isString()
  page?: string

  @isOptional()
  @isString()
  limit?: string
}

export class ListErrorsQuery {
  @isOptional()
  @isString()
  page?: string

  @isOptional()
  @isString()
  limit?: string
}

export class ListJobsQuery {
  @isOptional()
  @isIn(['running', 'pending', 'succeeded', 'failed'])
  state?: string

  @isOptional()
  @isString()
  page?: string

  @isOptional()
  @isString()
  limit?: string
}

export class ListMessagesQuery {
  @isOptional()
  @isIn(['humanMessage', 'botMessage', 'functionCall'])
  type?: string

  @isOptional()
  @isString()
  page?: string

  @isOptional()
  @isString()
  limit?: string
}

export class ChatIdParam {
  @isString()
  @isNotEmpty()
  id?: string
}
