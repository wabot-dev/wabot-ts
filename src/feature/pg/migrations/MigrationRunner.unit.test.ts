import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { MigrationRunner } from './MigrationRunner'

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wabot-mig-'))
}

test.describe('MigrationRunner file operations (no database)', () => {
  test('discover() returns [] when the directory does not exist', () => {
    const runner = new MigrationRunner({ dir: path.join(os.tmpdir(), 'wabot-does-not-exist-xyz') })
    assert.deepEqual(runner.discover(), [])
  })

  test('create() scaffolds numbered files and discover() orders them', () => {
    const dir = tempDir()
    try {
      const runner = new MigrationRunner({ dir })

      const first = runner.create('create users')
      assert.equal(path.basename(first), '0001_create_users.sql')

      const second = runner.create('add index')
      assert.equal(path.basename(second), '0002_add_index.sql')

      const discovered = runner.discover()
      assert.deepEqual(
        discovered.map((m) => m.id),
        ['0001_create_users', '0002_add_index'],
      )
      // each file is read and checksummed
      assert.ok(discovered.every((m) => m.checksum.length === 64))
      assert.ok(fs.readFileSync(first, 'utf-8').includes('0001_create_users.sql'))
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('non-migration files in the directory are ignored', () => {
    const dir = tempDir()
    try {
      fs.writeFileSync(path.join(dir, 'README.md'), '# notes')
      fs.writeFileSync(path.join(dir, 'notes.sql'), 'SELECT 1;') // no numeric prefix
      const runner = new MigrationRunner({ dir })
      runner.create('init')
      assert.deepEqual(
        runner.discover().map((m) => m.id),
        ['0001_init'],
      )
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('database operations require a pool', async () => {
    const runner = new MigrationRunner({ dir: tempDir() })
    await assert.rejects(() => runner.up(), /requires a pool/)
  })
})
