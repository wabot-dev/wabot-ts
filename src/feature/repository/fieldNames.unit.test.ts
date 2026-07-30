import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveAstFields, resolveFieldName, toSnakeCase } from './fieldNames'
import { parseQueryMethodName } from './parseQueryMethodName'

test.describe('toSnakeCase', () => {
  test('breaks on every capital', () => {
    assert.equal(toSnakeCase('fundingOpportunityId'), 'funding_opportunity_id')
    assert.equal(toSnakeCase('status'), 'status')
    assert.equal(toSnakeCase('startDate'), 'start_date')
  })

  test('digits stay attached to their word', () => {
    assert.equal(toSnakeCase('address2'), 'address2')
    assert.equal(toSnakeCase('line2Extra'), 'line2_extra')
  })
})

test.describe('resolveFieldName', () => {
  const fields = ['funding_opportunity_id', 'status', 'startDate']

  test('falls back to the snake_case spelling the repository declared', () => {
    assert.equal(resolveFieldName('fundingOpportunityId', fields), 'funding_opportunity_id')
  })

  test('a field declared as written is left alone', () => {
    assert.equal(resolveFieldName('startDate', fields), 'startDate')
    assert.equal(resolveFieldName('status', fields), 'status')
  })

  test('a name matching nothing is left alone, for the backend to report', () => {
    assert.equal(resolveFieldName('unknownThing', fields), 'unknownThing')
  })

  test('without a declared projection nothing is renamed', () => {
    assert.equal(resolveFieldName('fundingOpportunityId', undefined), 'fundingOpportunityId')
    assert.equal(resolveFieldName('fundingOpportunityId', []), 'fundingOpportunityId')
  })

  test('the framework keeps id and createdAt, whatever the table looks like', () => {
    const legacy = ['id', 'created_at', 'status']
    assert.equal(resolveFieldName('id', legacy), 'id')
    assert.equal(resolveFieldName('createdAt', legacy), 'createdAt')
  })
})

test.describe('resolveAstFields', () => {
  const fields = ['funding_opportunity_id', 'start_date', 'status']

  test('renames conditions and ordering alike', () => {
    const ast = resolveAstFields(
      parseQueryMethodName('findByFundingOpportunityIdAndStatusOrderByStartDateDesc'),
      fields,
    )
    assert.deepEqual(
      ast.conditions.map((c) => c.field),
      ['funding_opportunity_id', 'status'],
    )
    assert.deepEqual(
      ast.orderBy.map((o) => o.field),
      ['start_date'],
    )
  })

  test('operators, connectors and limits survive the rename', () => {
    const ast = resolveAstFields(
      parseQueryMethodName('findByStartDateGreaterThanOrStatusNotLimit5'),
      fields,
    )
    assert.deepEqual(ast.conditions, [
      { field: 'start_date', operator: 'Gt', connector: undefined },
      { field: 'status', operator: 'Not', connector: 'Or' },
    ])
    assert.equal(ast.limit, 5)
  })

  test('an AST that needs no renaming is returned as it came', () => {
    const ast = parseQueryMethodName('findByStatus')
    assert.equal(resolveAstFields(ast, fields), ast)
    assert.equal(resolveAstFields(ast, undefined), ast)
  })
})
