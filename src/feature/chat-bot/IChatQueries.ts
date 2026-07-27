import { Chat } from './Chat'
import { IChatConnection } from './IChatConnection'

/**
 * Custom (non field-equality) queries for `ChatRepository`, implemented once
 * per adapter (in-memory + Postgres). Both implementations ship with the
 * framework.
 */
export interface IChatQueries {
  /** The chat reachable through this channel connection, if any. */
  findByConnection(connection: IChatConnection): Promise<Chat | null>
}
