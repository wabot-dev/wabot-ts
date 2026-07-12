import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { ITwilioAccount } from './ITwilioAccount'
import { normalizeE164 } from './phoneNumber'

/**
 * Registry of Twilio accounts and the numbers they can dial from. Outbound
 * calls (see {@link TwilioCallService}) pick a `from` number and dial with the
 * credentials of the account that owns it — so one app can place calls from
 * several numbers, across several Twilio accounts.
 *
 * A single account from the environment (`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`
 * / `TWILIO_NUMBER`) is registered automatically, so existing single-number
 * setups keep working. Register more with {@link register}.
 */
@singleton()
export class TwilioAccountRegistry {
  private logger = new Logger('wabot:twilio-account-registry')
  private accounts: ITwilioAccount[] = []

  constructor() {
    this.seedFromEnv()
  }

  private seedFromEnv(): void {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const number = process.env.TWILIO_NUMBER
    if (accountSid && authToken && number) {
      this.register({ accountSid, authToken, numbers: [number] })
    }
  }

  /** Register an account and the caller-ID numbers it may dial from. */
  register(account: ITwilioAccount): void {
    const numbers = account.numbers.map(normalizeE164).filter((n) => n.length > 0)
    if (!account.accountSid || !account.authToken || numbers.length === 0) {
      this.logger.warn('ignoring Twilio account with missing sid/token/numbers')
      return
    }
    this.accounts.push({ accountSid: account.accountSid, authToken: account.authToken, numbers })
  }

  /** The account that owns `from` (E.164, any format), or undefined. */
  accountForNumber(from: string): ITwilioAccount | undefined {
    const target = normalizeE164(from)
    return this.accounts.find((account) => account.numbers.includes(target))
  }

  /** The default caller-ID number (first registered account's first number). */
  defaultNumber(): string | undefined {
    return this.accounts[0]?.numbers[0]
  }

  /** Every registered account (defensive copy). */
  all(): ITwilioAccount[] {
    return this.accounts.map((account) => ({ ...account, numbers: [...account.numbers] }))
  }
}
