import test from 'node:test'
import assert from 'node:assert/strict'

// Imported first and on its own, before the package index pulls the module
// graph in a friendlier order: ChatRepository builds ChatOperator, and
// ChatOperator declares a ChatRepository parameter. If either side imports the
// other as a value, decorator metadata is evaluated while the binding is still
// in its temporal dead zone and the module throws on load.
import { ChatRepository } from './ChatRepository'

test('ChatRepository can be imported on its own, without a cycle', () => {
  assert.equal(typeof ChatRepository, 'function')
  assert.equal(ChatRepository.name, 'ChatRepository')
})
