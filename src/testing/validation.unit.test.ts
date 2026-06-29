import assert from 'node:assert/strict'
import test from 'node:test'

import { isNotEmpty, isNumber, isOptional, isString, min } from '@/core/validation'

import { assertInvalid, assertValid, validateFixture } from './validation'

class SignupRequest {
  @isString()
  @isNotEmpty()
  name: string = ''

  @isNumber()
  @min(18)
  @isOptional()
  age?: number
}

test('validateFixture returns the transformed value when valid', () => {
  const { value, issues } = validateFixture(SignupRequest, { name: 'Ana', age: 30 })

  assert.equal(issues.length, 0)
  assert.ok(value instanceof SignupRequest)
  assert.equal(value.name, 'Ana')
})

test('validateFixture flattens issues with property paths', () => {
  const { value, issues } = validateFixture(SignupRequest, { name: '', age: 10 })

  assert.equal(value, undefined)
  assert.ok(issues.length >= 2)
  assert.ok(issues.some((issue) => issue.path === 'name'))
  assert.ok(issues.some((issue) => issue.path === 'age'))
})

test('assertValid returns the value and assertInvalid checks paths', () => {
  const value = assertValid(SignupRequest, { name: 'Ana' })
  assert.equal(value.name, 'Ana')

  assert.throws(() => assertValid(SignupRequest, { name: '' }), /SignupRequest to be valid/)

  const issues = assertInvalid(SignupRequest, { name: '' }, { path: 'name' })
  assert.ok(issues.length > 0)

  assert.throws(
    () => assertInvalid(SignupRequest, { name: '' }, { path: 'age' }),
    /Expected an issue at path 'age'/,
  )

  assert.throws(() => assertInvalid(SignupRequest, { name: 'Ana' }), /to be invalid, but it passed/)
})
