import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computeChecksum,
  nextMigrationFilename,
  parseMigrationName,
  planMigrations,
} from './migrationSupport'

test.describe('parseMigrationName', () => {
  test('parses order and id from a numbered .sql file', () => {
    assert.deepEqual(parseMigrationName('0001_create_users.sql'), {
      order: 1,
      id: '0001_create_users',
    })
  })

  test('rejects non-.sql files', () => {
    assert.equal(parseMigrationName('0001_create_users.txt'), null)
  })

  test('rejects files without a numeric prefix', () => {
    assert.equal(parseMigrationName('create_users.sql'), null)
  })
})

test.describe('computeChecksum', () => {
  test('is stable for the same content', () => {
    assert.equal(computeChecksum('SELECT 1;'), computeChecksum('SELECT 1;'))
  })

  test('normalizes CRLF so line endings do not cause false drift', () => {
    assert.equal(computeChecksum('a\r\nb'), computeChecksum('a\nb'))
  })

  test('differs for different content', () => {
    assert.notEqual(computeChecksum('SELECT 1;'), computeChecksum('SELECT 2;'))
  })
})

test.describe('nextMigrationFilename', () => {
  test('starts at 0001 when there are none', () => {
    assert.equal(nextMigrationFilename([], 'Create Users'), '0001_create_users.sql')
  })

  test('increments past the highest existing order and slugs the name', () => {
    assert.equal(nextMigrationFilename(['0003_x', '0001_y'], 'Add Index!!'), '0004_add_index.sql')
  })

  test('falls back to a default slug for an empty name', () => {
    assert.equal(nextMigrationFilename([], ''), '0001_migration.sql')
  })
})

test.describe('planMigrations', () => {
  const files = [
    { id: '0001_a', checksum: 'ha' },
    { id: '0002_b', checksum: 'hb' },
    { id: '0003_c', checksum: 'hc' },
  ]

  test('pending = on disk but not applied', () => {
    const plan = planMigrations(files, [{ name: '0001_a', checksum: 'ha' }])
    assert.deepEqual(plan.pending, ['0002_b', '0003_c'])
    assert.deepEqual(plan.drifted, [])
    assert.deepEqual(plan.missing, [])
  })

  test('drifted = applied but file checksum changed', () => {
    const plan = planMigrations(files, [{ name: '0001_a', checksum: 'DIFFERENT' }])
    assert.deepEqual(plan.drifted, ['0001_a'])
    assert.deepEqual(plan.pending, ['0002_b', '0003_c'])
  })

  test('missing = applied but no longer on disk', () => {
    const plan = planMigrations(files, [
      { name: '0001_a', checksum: 'ha' },
      { name: '0000_gone', checksum: 'x' },
    ])
    assert.deepEqual(plan.missing, ['0000_gone'])
  })

  test('fully applied and unchanged → nothing pending or drifted', () => {
    const plan = planMigrations(files, [
      { name: '0001_a', checksum: 'ha' },
      { name: '0002_b', checksum: 'hb' },
      { name: '0003_c', checksum: 'hc' },
    ])
    assert.deepEqual(plan.pending, [])
    assert.deepEqual(plan.drifted, [])
    assert.deepEqual(plan.missing, [])
  })
})
