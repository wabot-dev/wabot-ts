import { Pool } from 'pg'

import { singleton } from '@/core/injection'
import type { IChatSummary, IChatThreadItem } from './IChatsBrowser'

/**
 * Read-only chat browser/debugger queries. Lists conversations (with last
 * activity + message count) and loads a chat's message thread. Same shape and
 * fault-tolerance as MonitorStatsRepository (inject Pool, pool.query, try/catch
 * per method). PG-only.
 */
@singleton()
export class ChatBrowserRepository {
  constructor(private pool: Pool) {}

  async listChats(f: {
    channel?: string
    type?: string
    search?: string
    limit: number
    offset: number
  }): Promise<IChatSummary[]> {
    try {
      const { rows } = await this.pool.query(
        `SELECT c.id, c.created_at, c.data,
           (SELECT MAX(ci.created_at) FROM wabot.chat_item ci WHERE ci.chat_id = c.id) AS last_activity,
           (SELECT COUNT(*) FROM wabot.chat_item ci WHERE ci.chat_id = c.id) AS msg_count
         FROM wabot.chat c
         WHERE ($1::text IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(c.data->'connections') cn WHERE cn->>'channelName' = $1))
           AND ($2::text IS NULL OR c.data->>'type' = $2)
           AND ($3::text IS NULL OR c.id ILIKE '%' || $3 || '%')
         ORDER BY last_activity DESC NULLS LAST
         LIMIT $4 OFFSET $5`,
        [f.channel ?? null, f.type ?? null, f.search ?? null, f.limit, f.offset],
      )
      return rows.map((r: any) => this.toSummary(r))
    } catch {
      return []
    }
  }

  async countChats(f: { channel?: string; type?: string; search?: string }): Promise<number> {
    try {
      const { rows } = await this.pool.query<{ count: number | string }>(
        `SELECT COUNT(*)::int AS count FROM wabot.chat c
         WHERE ($1::text IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(c.data->'connections') cn WHERE cn->>'channelName' = $1))
           AND ($2::text IS NULL OR c.data->>'type' = $2)
           AND ($3::text IS NULL OR c.id ILIKE '%' || $3 || '%')`,
        [f.channel ?? null, f.type ?? null, f.search ?? null],
      )
      return Number(rows[0]?.count ?? 0)
    } catch {
      return 0
    }
  }

  async chatHeader(id: string): Promise<IChatSummary | null> {
    try {
      const { rows } = await this.pool.query(
        `SELECT c.id, c.created_at, c.data,
           (SELECT MAX(ci.created_at) FROM wabot.chat_item ci WHERE ci.chat_id = c.id) AS last_activity,
           (SELECT COUNT(*) FROM wabot.chat_item ci WHERE ci.chat_id = c.id) AS msg_count
         FROM wabot.chat c WHERE c.id = $1`,
        [id],
      )
      return rows[0] ? this.toSummary(rows[0]) : null
    } catch {
      return null
    }
  }

  async chatThread(id: string, limit = 1000): Promise<IChatThreadItem[]> {
    try {
      const { rows } = await this.pool.query(
        `SELECT id, created_at, data FROM wabot.chat_item WHERE chat_id = $1 ORDER BY created_at ASC LIMIT $2`,
        [id, limit],
      )
      return rows.map((r: any) => ({
        id: r.id,
        type: r.data?.type,
        createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
        data: r.data,
      }))
    } catch {
      return []
    }
  }

  private toSummary(r: any): IChatSummary {
    const data = r.data ?? {}
    const conns: any[] = Array.isArray(data.connections) ? data.connections : []
    return {
      id: r.id,
      type: data.type ?? '',
      channels: conns.map((c) => c?.channelName).filter(Boolean),
      associations: Array.isArray(data.associations) ? data.associations : [],
      createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
      lastActivity: r.last_activity ? new Date(r.last_activity).getTime() : null,
      msgCount: Number(r.msg_count ?? 0),
    }
  }
}
