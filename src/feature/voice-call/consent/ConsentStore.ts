/**
 * Records which numbers have consented to receive automated outbound calls.
 *
 * This default DENIES everything — outbound calling stays off until an app
 * registers a real store (e.g. {@link InMemoryConsentStore} or a DB-backed one):
 * `container.registerType(ConsentStore, InMemoryConsentStore)`. Automated calls
 * to individuals in Colombia are consent-gated (Ley 1581), so deny-by-default is
 * the safe posture.
 */
export class ConsentStore {
  async hasConsent(_e164: string): Promise<boolean> {
    return false
  }
}
