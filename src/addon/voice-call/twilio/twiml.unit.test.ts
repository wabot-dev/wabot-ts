import test from 'node:test'
import assert from 'node:assert/strict'
import { connectStreamTwiml } from './twiml'

test.describe('connectStreamTwiml', () => {
  test('wraps the stream URL in a Connect/Stream response', () => {
    const xml = connectStreamTwiml({ streamUrl: 'wss://host/voice/twilio/media' })
    assert.match(xml, /<Response><Connect><Stream url="wss:\/\/host\/voice\/twilio\/media">/)
    assert.match(xml, /<\/Stream><\/Connect><\/Response>$/)
    assert.doesNotMatch(xml, /<Parameter/)
  })

  test('emits <Parameter> entries and escapes XML', () => {
    const xml = connectStreamTwiml({
      streamUrl: 'wss://host/media?a=1&b=2',
      parameters: { from: '+573001112233', note: 'a<b' },
    })
    assert.match(xml, /url="wss:\/\/host\/media\?a=1&amp;b=2"/)
    assert.match(xml, /<Parameter name="from" value="\+573001112233"\/>/)
    assert.match(xml, /<Parameter name="note" value="a&lt;b"\/>/)
  })
})
