import test from 'node:test'
import assert from 'node:assert/strict'
import { renderDocument } from './renderDocument'
import { redirect, isRedirect } from './helpers'
import { escapeHtml } from './escape'

test.describe('renderDocument', () => {
  test('compone el shell HTML con titulo, meta, estilos y scripts', () => {
    const html = renderDocument({
      bodyHtml: '<main>hi</main>',
      title: 'Home',
      meta: { description: 'a page' },
      styles: ['/a.css'],
      scripts: ['/c.js'],
    })

    assert.ok(html.startsWith('<!doctype html><html lang="en">'))
    assert.match(html, /<title>Home<\/title>/)
    assert.match(html, /<meta name="description" content="a page">/)
    assert.match(html, /<link rel="stylesheet" href="\/a\.css">/)
    assert.match(html, /<body><main>hi<\/main><script type="module" src="\/c\.js"><\/script>/)
  })

  test('escapa el titulo para evitar inyeccion', () => {
    const html = renderDocument({ bodyHtml: '', title: '<x>&"' })
    assert.match(html, /<title>&lt;x&gt;&amp;&quot;<\/title>/)
  })

  test('omite el titulo cuando no se provee', () => {
    const html = renderDocument({ bodyHtml: '' })
    assert.doesNotMatch(html, /<title>/)
  })

  test('renderiza <link> de links (preload/preconnect) antes de los estilos', () => {
    const html = renderDocument({
      bodyHtml: '',
      styles: ['/a.css'],
      links: [
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true },
        { rel: 'preload', href: '/f.woff2', as: 'font', type: 'font/woff2', crossorigin: true },
      ],
    })
    assert.match(html, /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/)
    assert.match(
      html,
      /<link rel="preload" href="\/f\.woff2" as="font" type="font\/woff2" crossorigin>/,
    )
    // preload/preconnect antes de la hoja de estilos
    assert.ok(html.indexOf('rel="preload"') < html.indexOf('rel="stylesheet"'))
  })

  test('crossorigin=true => atributo escueto; string => con valor', () => {
    const html = renderDocument({
      bodyHtml: '',
      links: [{ rel: 'preload', href: '/x', as: 'fetch', crossorigin: 'use-credentials' }],
    })
    assert.match(html, /crossorigin="use-credentials"/)
  })
})

test.describe('redirect helper', () => {
  test('redirect crea un marcador con location y status', () => {
    const r = redirect('/login')
    assert.equal(r.location, '/login')
    assert.equal(r.status, 302)
    assert.ok(isRedirect(r))
  })

  test('isRedirect es falso para valores normales', () => {
    assert.equal(isRedirect({}), false)
    assert.equal(isRedirect(null), false)
    assert.equal(isRedirect('x'), false)
  })
})

test.describe('escapeHtml', () => {
  test('escapa caracteres especiales', () => {
    assert.equal(escapeHtml(`<a href="x">&'`), `&lt;a href=&quot;x&quot;&gt;&amp;&#39;`)
  })
})
