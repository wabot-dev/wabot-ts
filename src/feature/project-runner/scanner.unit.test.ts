import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { scanProjectFiles } from './scanner'

async function makeTree(
  spec: Record<string, string>,
): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), 'wabot-scan-'))
  for (const [rel, contents] of Object.entries(spec)) {
    const full = join(root, rel)
    await mkdir(full.substring(0, full.lastIndexOf(sep)), { recursive: true })
    await writeFile(full, contents, 'utf-8')
  }
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

function withCwd<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.cwd()
  process.chdir(dir)
  return fn().finally(() => process.chdir(prev))
}

test.describe('scanProjectFiles', () => {
  test('discovers .ts and .js files recursively', async () => {
    const { root, cleanup } = await makeTree({
      'src/a.ts': '',
      'src/sub/b.js': '',
      'src/sub/deep/c.ts': '',
    })
    try {
      const files = await withCwd(root, () => scanProjectFiles({ directories: ['src'] }))
      assert.equal(files.length, 3)
    } finally {
      await cleanup()
    }
  })

  test('excludes default test/spec file patterns', async () => {
    const { root, cleanup } = await makeTree({
      'src/Foo.ts': '',
      'src/Foo.unit.test.ts': '',
      'src/Foo.integration.test.ts': '',
      'src/Foo.spec.ts': '',
    })
    try {
      const files = await withCwd(root, () => scanProjectFiles({ directories: ['src'] }))
      assert.equal(files.length, 1)
      assert.ok(files[0].endsWith('Foo.ts'))
    } finally {
      await cleanup()
    }
  })

  test('skips _run_.ts and _cmd_.ts by default', async () => {
    const { root, cleanup } = await makeTree({
      'src/_run_.ts': '',
      'src/_cmd_.ts': '',
      'src/Real.ts': '',
    })
    try {
      const files = await withCwd(root, () => scanProjectFiles({ directories: ['src'] }))
      assert.equal(files.length, 1)
      assert.ok(files[0].endsWith('Real.ts'))
    } finally {
      await cleanup()
    }
  })

  test('honors directory-relative exclude paths', async () => {
    const { root, cleanup } = await makeTree({
      'src/keep/A.ts': '',
      'src/drop/B.ts': '',
    })
    try {
      const files = await withCwd(root, () =>
        scanProjectFiles({ directories: ['src'], exclude: ['drop'] }),
      )
      assert.equal(files.length, 1)
      assert.ok(files[0].endsWith(`keep${sep}A.ts`))
    } finally {
      await cleanup()
    }
  })

  test('ignores .d.ts declaration files', async () => {
    const { root, cleanup } = await makeTree({
      'src/types.d.ts': '',
      'src/runtime.ts': '',
    })
    try {
      const files = await withCwd(root, () => scanProjectFiles({ directories: ['src'] }))
      assert.equal(files.length, 1)
      assert.ok(files[0].endsWith('runtime.ts'))
    } finally {
      await cleanup()
    }
  })

  test('deduplicates overlapping directories', async () => {
    const { root, cleanup } = await makeTree({ 'src/A.ts': '' })
    try {
      const files = await withCwd(root, () => scanProjectFiles({ directories: ['src', 'src'] }))
      assert.equal(files.length, 1)
    } finally {
      await cleanup()
    }
  })

  test('returns empty array for missing directory', async () => {
    const { root, cleanup } = await makeTree({ 'src/A.ts': '' })
    try {
      const files = await withCwd(root, () => scanProjectFiles({ directories: ['does-not-exist'] }))
      assert.deepEqual(files, [])
    } finally {
      await cleanup()
    }
  })

  test('skips directories starting with __', async () => {
    const { root, cleanup } = await makeTree({
      'src/__internal/x.ts': '',
      'src/real/y.ts': '',
    })
    try {
      const files = await withCwd(root, () => scanProjectFiles({ directories: ['src'] }))
      assert.equal(files.length, 1)
      assert.ok(files[0].endsWith('y.ts'))
    } finally {
      await cleanup()
    }
  })
})
