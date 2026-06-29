import { CronExpressionParser } from 'cron-parser'

/** Poll a condition until it holds or the timeout elapses. */
export async function waitUntil(
  condition: () => Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 50,
) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    if (await condition()) return
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error('Condition not met within timeout')
}

export async function wait(timeoutMs = 5000) {
  await new Promise((r) => setTimeout(r, timeoutMs))
}

export interface ICronValidationOptions {
  timezone?: string
  toleranceMs?: number // allowed drift in milliseconds
}

/** Check that a sequence of dates matches consecutive firings of a cron expression. */
export function isValidCronSequence(
  cronExpression: string,
  dates: Date[],
  options: ICronValidationOptions = {},
): boolean {
  if (dates.length < 2) return false

  const {
    timezone = 'UTC',
    toleranceMs = 1000, // default 1 second tolerance
  } = options

  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: dates[0],
      tz: timezone,
    })

    for (let i = 1; i < dates.length; i++) {
      const expected = interval.next().toDate()
      const actual = dates[i]

      const diff = Math.abs(expected.getTime() - actual.getTime())

      if (diff > toleranceMs) {
        return false
      }
    }

    return true
  } catch {
    return false
  }
}
