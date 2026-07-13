import { injectable } from '@/core/injection'
import { MonitorStatsRepository } from './MonitorStatsRepository'
import type { IMonitorDashboard } from './IMonitorStats'

const DAY_MS = 86_400_000

/**
 * Orchestrates MonitorStatsRepository calls and shapes the DTO the dashboard
 * view consumes. Everything runs concurrently; each repo method is fault-tolerant.
 */
@injectable()
export class MonitorStatsService {
  constructor(private repo: MonitorStatsRepository) {}

  async getDashboard(): Promise<IMonitorDashboard> {
    const now = Date.now()
    const since24h = new Date(now - DAY_MS)
    const since7d = new Date(now - 7 * DAY_MS)

    const [
      convTotal,
      convByType,
      convByChannel,
      convNew24h,
      convNew7d,
      msgByType,
      msgLast24h,
      errTotal,
      errLast24h,
      errByCommand,
      jobs,
      cron,
    ] = await Promise.all([
      this.repo.countConversations(),
      this.repo.conversationsByType(),
      this.repo.conversationsByChannel(),
      this.repo.countNewConversationsSince(since24h),
      this.repo.countNewConversationsSince(since7d),
      this.repo.messagesByType(),
      this.repo.countMessagesSince(since24h),
      this.repo.countErrors(),
      this.repo.countErrorsSince(now - DAY_MS),
      this.repo.errorsByCommand(),
      this.repo.jobCounts(),
      this.repo.cronRows(),
    ])

    return {
      conversations: {
        total: convTotal,
        byType: convByType,
        byChannel: convByChannel,
        new24h: convNew24h,
        new7d: convNew7d,
      },
      messages: {
        total: msgByType.reduce((n, r) => n + r.count, 0),
        byType: msgByType,
        last24h: msgLast24h,
      },
      errors: {
        total: errTotal,
        last24h: errLast24h,
        byCommand: errByCommand,
      },
      jobs,
      cron,
      generatedAt: now,
    }
  }
}
