import test from 'node:test'
import assert from 'node:assert/strict'
import { pendingMediaStartIndex } from './pendingMediaStartIndex'
import { IChatItem } from './IChatItem'

const human = (text: string): IChatItem => ({ type: 'humanMessage', humanMessage: { text } })
const bot = (text: string): IChatItem => ({ type: 'botMessage', botMessage: { text } })
const call = (name: string): IChatItem => ({
  type: 'functionCall',
  functionCall: { id: name, name, arguments: '{}' },
})

test.describe('pendingMediaStartIndex', () => {
  test('returns 0 when there is no bot message yet', () => {
    assert.equal(pendingMediaStartIndex([]), 0)
    assert.equal(pendingMediaStartIndex([human('hi')]), 0)
    assert.equal(pendingMediaStartIndex([human('hi'), call('tool')]), 0)
  })

  test('points just after the last bot message', () => {
    const items = [human('a'), bot('b'), human('c')]
    assert.equal(pendingMediaStartIndex(items), 2)
  })

  test('uses the most recent bot message when several exist', () => {
    const items = [human('a'), bot('b'), human('c'), bot('d'), human('e')]
    assert.equal(pendingMediaStartIndex(items), 4)
  })

  test('keeps the current tool-calling exchange (after last bot reply) active', () => {
    const items = [human('a'), bot('b'), human('c'), call('tool')]
    // The new human message and its tool calls are all pending.
    assert.equal(pendingMediaStartIndex(items), 2)
  })

  test('treats everything as pending when the last item is the only bot message and nothing follows', () => {
    const items = [human('a'), bot('b')]
    assert.equal(pendingMediaStartIndex(items), 2)
  })
})
