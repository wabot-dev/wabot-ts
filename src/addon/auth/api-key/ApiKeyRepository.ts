import { ApiKey } from './ApiKey'
import { IApiKeyRepository } from './IApiKeyRepository'

export class ApiKeyRepository implements IApiKeyRepository {
  find(id: string): Promise<ApiKey | null> {
    throw new Error('Method not implemented.')
  }
  findOrThrow(id: string): Promise<ApiKey> {
    throw new Error('Method not implemented.')
  }

  create(item: ApiKey): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
