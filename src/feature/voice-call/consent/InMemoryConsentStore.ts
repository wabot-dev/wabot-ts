import { singleton } from '@/core/injection'
import { ConsentStore } from './ConsentStore'

/**
 * In-memory allowlist of consented numbers. Suitable for tests and single-node
 * setups; back consent with a database in production.
 */
@singleton()
export class InMemoryConsentStore extends ConsentStore {
  private allowed = new Set<string>()

  grant(e164: string) {
    this.allowed.add(e164)
  }

  revoke(e164: string) {
    this.allowed.delete(e164)
  }

  override async hasConsent(e164: string): Promise<boolean> {
    return this.allowed.has(e164)
  }
}
