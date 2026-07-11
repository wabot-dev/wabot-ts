import test from 'node:test'
import assert from 'node:assert/strict'
import { ConsentStore } from './ConsentStore'
import { InMemoryConsentStore } from './InMemoryConsentStore'
import { OutboundCallGate } from './OutboundCallGate'

test.describe('InMemoryConsentStore', () => {
  test('grants and revokes consent', async () => {
    const store = new InMemoryConsentStore()
    assert.equal(await store.hasConsent('+573001112233'), false)
    store.grant('+573001112233')
    assert.equal(await store.hasConsent('+573001112233'), true)
    store.revoke('+573001112233')
    assert.equal(await store.hasConsent('+573001112233'), false)
  })
})

test.describe('OutboundCallGate', () => {
  test('denies by default (base ConsentStore)', async () => {
    const gate = new OutboundCallGate(new ConsentStore())
    await assert.rejects(gate.assertAllowed('+573001112233'), /No consent on record/)
  })

  test('allows a consented number, rejects others', async () => {
    const store = new InMemoryConsentStore()
    store.grant('+573001112233')
    const gate = new OutboundCallGate(store)

    await gate.assertAllowed('+573001112233') // resolves
    await assert.rejects(gate.assertAllowed('+573009998877'), /No consent on record/)
  })
})
