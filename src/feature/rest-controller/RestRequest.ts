import { isRecord } from '@/core/validation'

export class RestRequest {
  @isRecord('string', 'string')
  headers?: Record<string, string>
}
