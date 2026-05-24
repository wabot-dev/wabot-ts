import { IJobOptions } from './IJobOptions'

export interface ICronJobScheduleConfig extends IJobOptions {
  name: string
  commandName: string
  cron: string
  enabled: boolean
  maxRunningJobs?: number
  misfirePolicy?: 'RUN_ONCE' | 'RUN_ALL' | 'SKIP'
}
