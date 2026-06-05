import test from 'node:test'
import assert from 'node:assert/strict'
import { unconsumedMediaStartIndex } from './unconsumedMediaStartIndex'
import { IChatItem } from './IChatItem'

const human = (text: string): IChatItem => ({ type: 'humanMessage', humanMessage: { text } })
const bot = (text: string): IChatItem => ({ type: 'botMessage', botMessage: { text } })
const call = (name: string): IChatItem => ({
  type: 'functionCall',
  functionCall: { id: name, name, arguments: '{}' },
})

test.describe('unconsumedMediaStartIndex', () => {
  test('returns 0 when the model has not produced output yet', () => {
    assert.equal(unconsumedMediaStartIndex([]), 0)
    assert.equal(unconsumedMediaStartIndex([human('hi')]), 0)
    assert.equal(unconsumedMediaStartIndex([human('a'), human('b')]), 0)
  })

  test('moves past a function call (media already consumed within the tool loop)', () => {
    assert.equal(unconsumedMediaStartIndex([human('analyze'), call('tool')]), 2)
    assert.equal(unconsumedMediaStartIndex([human('analyze'), call('t1'), call('t2')]), 3)
  })

  test('moves past a bot reply', () => {
    assert.equal(unconsumedMediaStartIndex([human('a'), bot('b'), human('c')]), 2)
  })

  test('uses whichever model output is most recent', () => {
    // function call after the last bot message keeps advancing the boundary
    assert.equal(unconsumedMediaStartIndex([human('a'), bot('b'), human('c'), call('t')]), 4)
  })
})
