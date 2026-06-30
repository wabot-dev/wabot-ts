import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import {
  generateEntry,
  generateIslandsRegistration,
  generateManifest,
  toManifestImport,
} from './manifest'

test.describe('toManifestImport', () => {
  const manifestDir = resolve('/tmp/proj/.wabot')

  test('rewrites .ts source files to .js', () => {
    const file = resolve('/tmp/proj/src/foo/Bar.ts')
    assert.equal(toManifestImport(file, manifestDir), '../src/foo/Bar.js')
  })

  test('rewrites .tsx source files to .js', () => {
    const file = resolve('/tmp/proj/src/foo/Bar.tsx')
    assert.equal(toManifestImport(file, manifestDir), '../src/foo/Bar.js')
  })

  test('leaves .js source files unchanged', () => {
    const file = resolve('/tmp/proj/src/foo/Bar.js')
    assert.equal(toManifestImport(file, manifestDir), '../src/foo/Bar.js')
  })

  test('emits forward slashes regardless of platform', () => {
    const result = toManifestImport(resolve('/tmp/proj/src/a/b/c/D.ts'), manifestDir)
    assert.ok(!result.includes('\\'), `result should not contain backslashes: ${result}`)
  })

  test('always begins with ./ or ../', () => {
    const sibling = toManifestImport(resolve('/tmp/proj/.wabot/peer.ts'), manifestDir)
    assert.ok(sibling.startsWith('./'), sibling)
    const above = toManifestImport(resolve('/tmp/proj/src/up.ts'), manifestDir)
    assert.ok(above.startsWith('../'), above)
  })
})

test.describe('generateManifest', () => {
  const manifestDir = resolve('/tmp/proj/.wabot')

  test('returns banner-only output for an empty input', () => {
    const out = generateManifest([], manifestDir)
    assert.match(out, /^\/\/ auto-generated/)
    assert.ok(!out.includes('import '))
  })

  test('emits one import per file using relative .js specifiers', () => {
    const files = [resolve('/tmp/proj/src/a/Foo.ts'), resolve('/tmp/proj/src/b/Bar.ts')]
    const out = generateManifest(files, manifestDir)
    assert.ok(out.includes("import '../src/a/Foo.js'"))
    assert.ok(out.includes("import '../src/b/Bar.js'"))
  })

  test('is deterministic regardless of input ordering', () => {
    const files = [resolve('/tmp/proj/src/b/Bar.ts'), resolve('/tmp/proj/src/a/Foo.ts')]
    const sorted = generateManifest(
      [resolve('/tmp/proj/src/a/Foo.ts'), resolve('/tmp/proj/src/b/Bar.ts')],
      manifestDir,
    )
    const unsorted = generateManifest(files, manifestDir)
    assert.equal(sorted, unsorted)
  })
})

test.describe('generateEntry', () => {
  const manifestDir = resolve('/tmp/proj/.wabot')
  const pkg = '@wabot-dev/framework'

  test('imports the manifest first', () => {
    const out = generateEntry(manifestDir, null, pkg)
    const manifestIdx = out.indexOf("import './manifest.js'")
    const runIdx = out.indexOf('__wabot_run')
    assert.ok(manifestIdx >= 0)
    assert.ok(runIdx > manifestIdx)
  })

  test('calls run with preloaded: true when no consumer entry is given', () => {
    const out = generateEntry(manifestDir, null, pkg)
    assert.ok(out.includes('__wabot_run({ preloaded: true })'))
  })

  test('spreads consumer config and forces preloaded: true', () => {
    const entry = resolve('/tmp/proj/src/_run_.ts')
    const out = generateEntry(manifestDir, entry, pkg)
    assert.ok(out.includes("from '../src/_run_.js'"), out)
    assert.ok(out.includes('preloaded: true'))
    assert.ok(out.includes('...'))
  })

  test('imports island registration when islands are present', () => {
    const out = generateEntry(manifestDir, null, pkg, true)
    assert.ok(out.includes("import './islands.js'"))
  })

  test('omits island registration when there are no islands', () => {
    const out = generateEntry(manifestDir, null, pkg, false)
    assert.ok(!out.includes("import './islands.js'"))
  })
})

test.describe('generateIslandsRegistration', () => {
  const manifestDir = resolve('/tmp/proj/.wabot')
  const pkg = '@wabot-dev/framework'

  test('imports each island and stamps its id', () => {
    const out = generateIslandsRegistration(
      [
        { absFile: resolve('/tmp/proj/src/ui/Counter.island.tsx'), id: 'Counter-1234abcd' },
        { absFile: resolve('/tmp/proj/src/ui/Clock.island.tsx'), id: 'Clock-5678efgh' },
      ],
      manifestDir,
      pkg,
    )
    assert.ok(out.includes(`import { setIslandId } from '${pkg}'`))
    assert.ok(out.includes("import __island0 from '../src/ui/Clock.island.js'"))
    assert.ok(out.includes('setIslandId(__island0, "Clock-5678efgh")'))
    assert.ok(out.includes("import __island1 from '../src/ui/Counter.island.js'"))
    assert.ok(out.includes('setIslandId(__island1, "Counter-1234abcd")'))
  })
})
