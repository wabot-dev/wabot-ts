import { ApiKey } from './ApiKey'

export interface IApiKeyRepository {
  find(id: string): Promise<ApiKey | null>
  findOrThrow(id: string): Promise<ApiKey>
  create(item: ApiKey): Promise<void>
}
