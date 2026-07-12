import test from 'node:test'
import assert from 'node:assert/strict'
import { TwilioAccountRegistry } from './TwilioAccountRegistry'

test.describe('TwilioAccountRegistry', () => {
  test('matches a number regardless of formatting', () => {
    const registry = new TwilioAccountRegistry()
    registry.register({ accountSid: 'AC1', authToken: 't1', numbers: ['+1 (555) 111-2222'] })
    assert.equal(registry.accountForNumber('+15551112222')?.accountSid, 'AC1')
  })

  test('picks the owning account among several', () => {
    const registry = new TwilioAccountRegistry()
    registry.register({ accountSid: 'AC1', authToken: 't1', numbers: ['+15551112222'] })
    registry.register({ accountSid: 'AC2', authToken: 't2', numbers: ['+573001112233'] })
    assert.equal(registry.accountForNumber('+573001112233')?.accountSid, 'AC2')
    assert.equal(registry.accountForNumber('+573001112233')?.authToken, 't2')
  })

  test('returns undefined for an unregistered number', () => {
    const registry = new TwilioAccountRegistry()
    registry.register({ accountSid: 'AC1', authToken: 't1', numbers: ['+15551112222'] })
    assert.equal(registry.accountForNumber('+15559990000'), undefined)
  })

  test('ignores accounts missing credentials or numbers', () => {
    const registry = new TwilioAccountRegistry()
    registry.register({ accountSid: '', authToken: 't', numbers: ['+15551112222'] })
    registry.register({ accountSid: 'AC1', authToken: 't1', numbers: [] })
    assert.equal(registry.accountForNumber('+15551112222'), undefined)
  })
})
