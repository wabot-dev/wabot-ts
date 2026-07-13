import { ApiKey } from './ApiKey'

/**
 * Custom (non field-equality) queries for {@link ApiKeyRepository}, implemented
 * once per adapter (in-memory + Postgres). Both implementations ship with the
 * framework, so apps get `findByMetadata` for free on either store.
 */
export interface IApiKeyQueries<A extends object> {
  /** Keys whose metadata contains every given key/value pair. */
  findByMetadata(metadata: Record<string, string>): Promise<ApiKey<A>[]>
}
