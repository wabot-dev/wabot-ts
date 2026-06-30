import test from 'node:test'
import assert from 'node:assert/strict'
import { h } from 'preact'
import { PreactRenderer } from './PreactRenderer'
import { island, setIslandId } from '@/feature/ui-controller'

test.describe('PreactRenderer', () => {
  const renderer = new PreactRenderer()

  test('renderiza un arbol de vnodes a HTML estatico', () => {
    const result = renderer.renderToString(h('main', null, h('h1', null, 'Hello')))
    assert.equal(result.html, '<main><h1>Hello</h1></main>')
    assert.deepEqual(result.islands, [])
  })

  test('envuelve los islands en un host de hidratacion y los recolecta', () => {
    function Counter(props: { start: number }) {
      return h('button', null, String(props.start))
    }
    const CounterIsland = island(Counter)
    setIslandId(CounterIsland, 'counter-1')

    const result = renderer.renderToString(h(CounterIsland as any, { start: 3 }))

    assert.equal(
      result.html,
      '<wabot-island data-island="counter-1" data-props="{&quot;start&quot;:3}"><button>3</button></wabot-island>',
    )
    assert.deepEqual(result.islands, [{ id: 'counter-1', props: { start: 3 } }])
  })

  test('expone configuracion de cliente para el bundler', () => {
    assert.ok(renderer.client)
    assert.equal(renderer.client?.esbuildJsx?.jsxImportSource, 'preact')
    const entry = renderer.client?.islandEntrySource({ id: 'x', importPath: '/abs/X.island.tsx' })
    assert.match(entry ?? '', /registerIsland\("x", Island\)/)
    assert.match(entry ?? '', /from "\/abs\/X\.island\.tsx"/)
  })
})
