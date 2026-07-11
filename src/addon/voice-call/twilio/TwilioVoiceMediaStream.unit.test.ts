import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ITwilioMediaSocket,
  ITwilioStreamStart,
  TwilioVoiceMediaStream,
} from './TwilioVoiceMediaStream'

class FakeSocket implements ITwilioMediaSocket {
  sent: any[] = []
  closed = false
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.closed = true
  }
}

const startMessage = (over: Record<string, any> = {}) =>
  JSON.stringify({
    event: 'start',
    start: {
      streamSid: 'MZ123',
      callSid: 'CA999',
      customParameters: { from: '+573001112233', to: '+576011234567' },
      ...over,
    },
  })

const mediaMessage = (payload: string) => JSON.stringify({ event: 'media', media: { payload } })

test.describe('TwilioVoiceMediaStream', () => {
  test('fires onStart with streamSid, callSid and custom parameters', () => {
    const media = new TwilioVoiceMediaStream(new FakeSocket())
    const starts: ITwilioStreamStart[] = []
    media.onStart((s) => starts.push(s))

    media.handleMessage(startMessage())

    assert.equal(starts.length, 1)
    assert.equal(starts[0].streamSid, 'MZ123')
    assert.equal(starts[0].callSid, 'CA999')
    assert.equal(starts[0].customParameters.from, '+573001112233')
  })

  test('buffers inbound audio until a listener attaches, then flushes', () => {
    const media = new TwilioVoiceMediaStream(new FakeSocket())
    media.handleMessage(startMessage())
    media.handleMessage(mediaMessage('AAAA')) // arrives before onAudio

    const got: string[] = []
    media.onAudio((a) => got.push(a))
    assert.deepEqual(got, ['AAAA']) // flushed on registration

    media.handleMessage(mediaMessage('BBBB')) // arrives after
    assert.deepEqual(got, ['AAAA', 'BBBB'])
  })

  test('forwards DTMF digits', () => {
    const media = new TwilioVoiceMediaStream(new FakeSocket())
    const digits: string[] = []
    media.onDtmf((d) => digits.push(d))
    media.handleMessage(JSON.stringify({ event: 'dtmf', dtmf: { digit: '5' } }))
    assert.deepEqual(digits, ['5'])
  })

  test('play() sends a media frame tagged with the streamSid', () => {
    const socket = new FakeSocket()
    const media = new TwilioVoiceMediaStream(socket)

    media.play('early') // no streamSid yet → dropped
    assert.equal(socket.sent.length, 0)

    media.handleMessage(startMessage())
    media.play('spoken')
    assert.deepEqual(socket.sent.at(-1), {
      event: 'media',
      streamSid: 'MZ123',
      media: { payload: 'spoken' },
    })
  })

  test('clear() sends a clear event for barge-in', () => {
    const socket = new FakeSocket()
    const media = new TwilioVoiceMediaStream(socket)
    media.handleMessage(startMessage())
    media.clear()
    assert.deepEqual(socket.sent.at(-1), { event: 'clear', streamSid: 'MZ123' })
  })

  test('stop event closes the stream once and notifies listeners', () => {
    const socket = new FakeSocket()
    const media = new TwilioVoiceMediaStream(socket)
    let closes = 0
    media.onClose(() => closes++)

    media.handleMessage(startMessage())
    media.handleMessage(JSON.stringify({ event: 'stop' }))
    media.handleClose() // socket close after stop → still only one close

    assert.equal(closes, 1)
    assert.equal(socket.closed, true)
  })

  test('ignores malformed messages', () => {
    const media = new TwilioVoiceMediaStream(new FakeSocket())
    assert.doesNotThrow(() => media.handleMessage('not json'))
  })
})
