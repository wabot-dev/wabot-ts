/**
 * Wabot monitor WebUI — a read-only operational dashboard over the framework's
 * own PostgreSQL tables: conversations, messages, errors, async jobs and cron.
 *
 * Activate in an app by importing this entry; the side effect registers the
 * `@uiController` and the DI components. Requires DATABASE_URL (PostgreSQL
 * mode) and a MONITOR_API_KEY to protect the page.
 *
 *   import '@wabot-dev/framework/monitor'
 *   // then open /monitor?key=<MONITOR_API_KEY>
 */
export { MonitorController } from './MonitorController'
export { ChatBrowserController } from './ChatBrowserController'
export { MonitorStatsService } from './MonitorStatsService'
export { MonitorStatsRepository } from './MonitorStatsRepository'
export { ChatBrowserRepository } from './ChatBrowserRepository'
export { MonitorAuthMiddleware } from './MonitorAuthMiddleware'
// Shared UI kit + auth: reusable building blocks for custom domain monitors.
export { BarList, DataTable, KpiCard, MonitorShell, Pager, Section } from './ui/components'
export * from './IMonitorStats'
export * from './IChatsBrowser'
