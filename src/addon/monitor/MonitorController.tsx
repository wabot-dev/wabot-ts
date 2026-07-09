import { uiController, view } from '@/ui'
import { MonitorAuthMiddleware } from './MonitorAuthMiddleware'
import { MonitorStatsService } from './MonitorStatsService'
import { DashboardPage } from './ui/DashboardPage'

/**
 * Read-only operational dashboard served at `/monitor`. SSR (Preact), no
 * client JS. Protected by MonitorAuthMiddleware (MONITOR_API_KEY via ?key=
 * or cookie). Requires DATABASE_URL (PostgreSQL) — the service/repo resolve
 * Pool, which is only registered in PG mode.
 */
@uiController({ path: '/monitor', middlewares: [MonitorAuthMiddleware] })
export class MonitorController {
  constructor(private stats: MonitorStatsService) {}

  @view({ title: 'Wabot Monitor' })
  async dashboard() {
    const data = await this.stats.getDashboard()
    return <DashboardPage stats={data} />
  }
}
