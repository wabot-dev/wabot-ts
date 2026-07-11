import { singleton } from '@/core/injection'
import { ConsentStore } from './ConsentStore'

/**
 * Guards outbound dialing behind recorded consent. Throws (rather than silently
 * dropping) so a missing-consent bug is loud, not a compliance surprise.
 */
@singleton()
export class OutboundCallGate {
  constructor(private store: ConsentStore) {}

  async assertAllowed(e164: string): Promise<void> {
    if (!(await this.store.hasConsent(e164))) {
      throw new Error(
        `No consent on record for ${e164}; cannot place an outbound call. ` +
          `Record consent in a ConsentStore before dialing.`,
      )
    }
  }
}
