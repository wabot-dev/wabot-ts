import test from 'node:test'
import assert from 'node:assert/strict'

import { parseQueryMethodName } from './parseQueryMethodName'

test.describe('parseQueryMethodName', () => {
  test.describe('prefixes', () => {
    test('parses "find" prefix', () => {
      const ast = parseQueryMethodName('findByName')
      assert.equal(ast.prefix, 'find')
    })

    test('parses "findOne" prefix and prefers it over "find"', () => {
      const ast = parseQueryMethodName('findOneByEmail')
      assert.equal(ast.prefix, 'findOne')
      assert.deepEqual(ast.conditions, [
        { field: 'email', operator: 'Equals', connector: undefined },
      ])
    })

    test('parses "count" prefix', () => {
      const ast = parseQueryMethodName('countByStatus')
      assert.equal(ast.prefix, 'count')
    })

    test('parses "exists" prefix', () => {
      const ast = parseQueryMethodName('existsByEmail')
      assert.equal(ast.prefix, 'exists')
    })

    test('parses "delete" prefix', () => {
      const ast = parseQueryMethodName('deleteByStatus')
      assert.equal(ast.prefix, 'delete')
    })

    test('throws on unknown prefix', () => {
      assert.throws(() => parseQueryMethodName('fetchByName'), /must start with one of/)
    })
  })

  test.describe('All / no-conditions', () => {
    test('parses findAll', () => {
      const ast = parseQueryMethodName('findAll')
      assert.equal(ast.prefix, 'find')
      assert.deepEqual(ast.conditions, [])
    })

    test('parses findAllOrderByCreatedAtDesc', () => {
      const ast = parseQueryMethodName('findAllOrderByCreatedAtDesc')
      assert.deepEqual(ast.conditions, [])
      assert.deepEqual(ast.orderBy, [{ field: 'createdAt', direction: 'DESC' }])
    })

    test('throws if rest is neither By* nor All', () => {
      assert.throws(() => parseQueryMethodName('findSomething'), /expected "By<\.\.\.>" or "All"/)
    })
  })

  test.describe('single conditions', () => {
    test('default equals operator', () => {
      const ast = parseQueryMethodName('findByName')
      assert.deepEqual(ast.conditions, [
        { field: 'name', operator: 'Equals', connector: undefined },
      ])
    })

    test('lowercases first character of multi-word field', () => {
      const ast = parseQueryMethodName('findByCreatedAt')
      assert.deepEqual(ast.conditions, [
        { field: 'createdAt', operator: 'Equals', connector: undefined },
      ])
    })

    test('Like operator', () => {
      const ast = parseQueryMethodName('findByNameLike')
      assert.deepEqual(ast.conditions, [{ field: 'name', operator: 'Like', connector: undefined }])
    })

    test('NotLike operator', () => {
      const ast = parseQueryMethodName('findByNameNotLike')
      assert.deepEqual(ast.conditions, [
        { field: 'name', operator: 'NotLike', connector: undefined },
      ])
    })

    test('Not operator', () => {
      const ast = parseQueryMethodName('findByStatusNot')
      assert.deepEqual(ast.conditions, [{ field: 'status', operator: 'Not', connector: undefined }])
    })

    test('In operator', () => {
      const ast = parseQueryMethodName('findByStatusIn')
      assert.deepEqual(ast.conditions, [{ field: 'status', operator: 'In', connector: undefined }])
    })

    test('NotIn operator', () => {
      const ast = parseQueryMethodName('findByStatusNotIn')
      assert.deepEqual(ast.conditions, [
        { field: 'status', operator: 'NotIn', connector: undefined },
      ])
    })

    test('GreaterThan / Gt operators map to Gt', () => {
      assert.equal(parseQueryMethodName('findByAgeGreaterThan').conditions[0].operator, 'Gt')
      assert.equal(parseQueryMethodName('findByAgeGt').conditions[0].operator, 'Gt')
    })

    test('GreaterThanEqual / Gte operators map to Gte', () => {
      assert.equal(parseQueryMethodName('findByAgeGreaterThanEqual').conditions[0].operator, 'Gte')
      assert.equal(parseQueryMethodName('findByAgeGte').conditions[0].operator, 'Gte')
    })

    test('LessThan / Lt operators map to Lt', () => {
      assert.equal(parseQueryMethodName('findByAgeLessThan').conditions[0].operator, 'Lt')
      assert.equal(parseQueryMethodName('findByAgeLt').conditions[0].operator, 'Lt')
    })

    test('LessThanEqual / Lte operators map to Lte', () => {
      assert.equal(parseQueryMethodName('findByAgeLessThanEqual').conditions[0].operator, 'Lte')
      assert.equal(parseQueryMethodName('findByAgeLte').conditions[0].operator, 'Lte')
    })

    test('IsNull and IsNotNull operators', () => {
      assert.equal(parseQueryMethodName('findByEmailIsNull').conditions[0].operator, 'IsNull')
      assert.equal(parseQueryMethodName('findByEmailIsNotNull').conditions[0].operator, 'IsNotNull')
    })

    test('multi-word field with operator at the end', () => {
      const ast = parseQueryMethodName('findByCreatedAtGreaterThan')
      assert.deepEqual(ast.conditions, [
        { field: 'createdAt', operator: 'Gt', connector: undefined },
      ])
    })
  })

  test.describe('connectors', () => {
    test('And connector', () => {
      const ast = parseQueryMethodName('findByStatusAndType')
      assert.deepEqual(ast.conditions, [
        { field: 'status', operator: 'Equals', connector: undefined },
        { field: 'type', operator: 'Equals', connector: 'And' },
      ])
    })

    test('Or connector', () => {
      const ast = parseQueryMethodName('findByStatusOrType')
      assert.deepEqual(ast.conditions, [
        { field: 'status', operator: 'Equals', connector: undefined },
        { field: 'type', operator: 'Equals', connector: 'Or' },
      ])
    })

    test('mixed connectors with operators', () => {
      const ast = parseQueryMethodName('findByNameLikeAndAgeGreaterThanOrEmailIsNull')
      assert.deepEqual(ast.conditions, [
        { field: 'name', operator: 'Like', connector: undefined },
        { field: 'age', operator: 'Gt', connector: 'And' },
        { field: 'email', operator: 'IsNull', connector: 'Or' },
      ])
    })
  })

  test.describe('OrderBy', () => {
    test('single OrderBy', () => {
      const ast = parseQueryMethodName('findByStatusOrderByCreatedAtDesc')
      assert.deepEqual(ast.orderBy, [{ field: 'createdAt', direction: 'DESC' }])
    })

    test('multiple OrderBy fields', () => {
      const ast = parseQueryMethodName('findByStatusOrderByCreatedAtDescNameAsc')
      assert.deepEqual(ast.orderBy, [
        { field: 'createdAt', direction: 'DESC' },
        { field: 'name', direction: 'ASC' },
      ])
    })

    test('throws when OrderBy field is missing direction', () => {
      assert.throws(
        () => parseQueryMethodName('findByStatusOrderByCreatedAt'),
        /missing Asc\/Desc direction/,
      )
    })

    test('throws when OrderBy is empty', () => {
      assert.throws(() => parseQueryMethodName('findByStatusOrderBy'), /OrderBy clause/)
    })
  })

  test.describe('Limit', () => {
    test('extracts numeric limit', () => {
      const ast = parseQueryMethodName('findByStatusLimit10')
      assert.equal(ast.limit, 10)
      assert.deepEqual(ast.conditions, [
        { field: 'status', operator: 'Equals', connector: undefined },
      ])
    })

    test('limit combined with OrderBy', () => {
      const ast = parseQueryMethodName('findByStatusOrderByCreatedAtDescLimit5')
      assert.equal(ast.limit, 5)
      assert.deepEqual(ast.orderBy, [{ field: 'createdAt', direction: 'DESC' }])
    })

    test('limit with findAll', () => {
      const ast = parseQueryMethodName('findAllLimit3')
      assert.equal(ast.limit, 3)
      assert.deepEqual(ast.conditions, [])
    })

    test('throws when findOne is paired with Limit', () => {
      assert.throws(() => parseQueryMethodName('findOneByEmailLimit5'), /findOne implies LIMIT 1/)
    })
  })

  test.describe('hard-fail edge cases', () => {
    test('throws when condition starts with a connector', () => {
      assert.throws(() => parseQueryMethodName('findByAndStatus'), /cannot start with connector/)
    })
  })
})
