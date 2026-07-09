/** DTOs for the monitor dashboard. All derived read-only from existing tables. */

export interface INameCount {
  name: string
  count: number
}

export interface IErrorRow {
  id: string
  commandName: string
  message: string
  /** epoch ms */
  time: number | null
  stack: string | null
}

export interface IConversationStats {
  total: number
  byType: INameCount[]
  byChannel: INameCount[]
  new24h: number
  new7d: number
}

export interface IMessageStats {
  total: number
  /** humanMessage / botMessage / functionCall */
  byType: INameCount[]
  last24h: number
}

export interface IErrorStats {
  total: number
  last24h: number
  recent: IErrorRow[]
  byCommand: INameCount[]
}

export interface IJobStats {
  running: number
  pending: number
  succeeded: number
  failed: number
}

export interface ICronRow {
  name: string
  commandName: string
  cron: string
  enabled: boolean
  /** epoch ms */
  lastRunAt: number | null
  /** epoch ms */
  nextRunAt: number | null
}

export interface IMonitorDashboard {
  conversations: IConversationStats
  messages: IMessageStats
  errors: IErrorStats
  jobs: IJobStats
  cron: ICronRow[]
  /** epoch ms */
  generatedAt: number
}
