import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { UiBundler } from './UiBundler'
import { NAV_ENTRY_ID } from './manifest'
import { PreactRenderer } from '@/addon/ui/preact'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../../..')
const clientUiModule = path.resolve(repoRoot, 'src/ui/client.ts')
const islandPath = path.resolve(here, '__fixtures__/Counter.island.tsx')

test.describe('UiBundler', () => {
  test('compila el bundle de cliente de un island y produce manifest', async () => {
    const renderer = new PreactRenderer()
    const bundler = new UiBundler({
      islands: [
        { id: 'Counter-test', importPath: islandPath, relPath: 'fixtures/Counter.island.tsx' },
      ],
      client: renderer.client!,
      cwd: repoRoot,
      alias: { '@/ui': clientUiModule },
    })

    const outDir = await mkdtemp(path.join(tmpdir(), 'wabot-ui-'))
    try {
      const manifest = await bundler.buildProd(outDir)

      const asset = manifest.islands['Counter-test']
      assert.ok(asset, 'manifest should contain the island')
      assert.equal(asset.js, '/_wabot/Counter-test.js')

      const code = await readFile(path.join(outDir, 'Counter-test.js'), 'utf-8')
      assert.match(code, /Counter-test/) // id literal passed to registerIsland
      assert.match(code, /button/) // the island's DOM survives bundling
    } finally {
      await rm(outDir, { recursive: true, force: true })
    }
  })

  test('emite el runtime de navegación boosted y lo publica en el manifest', async () => {
    const renderer = new PreactRenderer()
    const bundler = new UiBundler({
      islands: [
        { id: 'Counter-test', importPath: islandPath, relPath: 'fixtures/Counter.island.tsx' },
      ],
      client: renderer.client!,
      cwd: repoRoot,
      alias: { '@/ui': clientUiModule },
    })

    const outDir = await mkdtemp(path.join(tmpdir(), 'wabot-ui-nav-'))
    try {
      const manifest = await bundler.buildProd(outDir)

      assert.equal(manifest.nav, '/_wabot/_nav.js', 'manifest exposes the nav runtime url')
      assert.ok(!manifest.islands[NAV_ENTRY_ID], 'nav entry is not listed as an island')

      const nav = await readFile(path.join(outDir, '_nav.js'), 'utf-8')
      // Nav entry shares the island runtime chunk (hydrate/unmount hooks) rather
      // than inlining Preact again.
      assert.match(nav, /chunks\//, 'nav entry imports the shared runtime chunk')
    } finally {
      await rm(outDir, { recursive: true, force: true })
    }
  })

  test('emite CSS Modules como hoja de estilos del island', async () => {
    const renderer = new PreactRenderer()
    const bundler = new UiBundler({
      islands: [
        {
          id: 'Styled-test',
          importPath: path.resolve(here, '__fixtures__/Styled.island.tsx'),
          relPath: 'fixtures/Styled.island.tsx',
        },
      ],
      client: renderer.client!,
      cwd: repoRoot,
      alias: { '@/ui': clientUiModule },
    })

    const outDir = await mkdtemp(path.join(tmpdir(), 'wabot-ui-css-'))
    try {
      const manifest = await bundler.buildProd(outDir)
      const asset = manifest.islands['Styled-test']
      assert.ok(asset, 'manifest should contain the island')
      assert.equal(asset.css.length, 1, 'island should expose one stylesheet')

      const cssFile = path.join(outDir, path.basename(asset.css[0]))
      const css = await readFile(cssFile, 'utf-8')
      assert.match(css, /color:\s*red/)
    } finally {
      await rm(outDir, { recursive: true, force: true })
    }
  })
})
