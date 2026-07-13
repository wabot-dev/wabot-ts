import { uiController, view } from '@/ui'
import { MonitorAuthMiddleware } from './MonitorAuthMiddleware'
import { MonitorStatsRepository } from './MonitorStatsRepository'
import { MonitorStatsService } from './MonitorStatsService'
import { ListErrorsQuery, ListJobsQuery, ListMessagesQuery } from './QueryDto'
import { limitOf, pageOf } from './ui/format'
import { ErrorsPage, HubPage, JobsPage, MessagesPage } from './ui/pages'

/**
 * Operational monitor at `/monitor`: the Overview hub plus drill-down list
 * views for errors, jobs and messages. SSR, no client JS; auth via
 * MonitorAuthMiddleware. Shares the `/monitor` base path with ChatBrowserController
 * (disjoint sub-paths).
 */
@uiController({ path: '/monitor', middlewares: [MonitorAuthMiddleware], head: { preconnect: ['https://design.wabot.dev'] } })
export class MonitorController {
  constructor(
    private stats: MonitorStatsService,
    private repo: MonitorStatsRepository,
  ) {}

  @view({ title: 'Wabot Monitor' })
  async hub() {
    return <HubPage stats={await this.stats.getDashboard()} />
  }

  @view({ path: 'errors', title: 'Errores · Monitor' })
  async errors(input: ListErrorsQuery) {
    const page = pageOf(input.page)
    const pageSize = limitOf(input.limit)
    const [rows, total] = await Promise.all([
      this.repo.listErrors(pageSize, (page - 1) * pageSize),
      this.repo.countErrors(),
    ])
    return <ErrorsPage rows={rows} total={total} page={page} pageSize={pageSize} query={input} />
  }

  @view({ path: 'jobs', title: 'Jobs · Monitor' })
  async jobs(input: ListJobsQuery) {
    const page = pageOf(input.page)
    const pageSize = limitOf(input.limit)
    const [rows, total] = await Promise.all([
      this.repo.listJobs(input.state, pageSize, (page - 1) * pageSize),
      this.repo.countJobs(input.state),
    ])
    return <JobsPage rows={rows} total={total} page={page} pageSize={pageSize} query={input} />
  }

  @view({ path: 'messages', title: 'Mensajes · Monitor' })
  async messages(input: ListMessagesQuery) {
    const page = pageOf(input.page)
    const pageSize = limitOf(input.limit)
    const [rows, total] = await Promise.all([
      this.repo.listMessages(input.type, pageSize, (page - 1) * pageSize),
      this.repo.countMessages(input.type),
    ])
    return <MessagesPage rows={rows} total={total} page={page} pageSize={pageSize} query={input} />
  }
}
