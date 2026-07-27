import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

import { mountUiDevAssets, type IUiDevAssets } from './devMiddleware'
import type { UiBundler } from './UiBundler'

/** Enough of a bundler for the live-reload server; assets are covered elsewhere. */
function stubBundler(): UiBundler {
  return { onRebuild: () => {}, getFile: async () => undefined } as unknown as UiBundler
}

test('el live reload elige otro puerto si el preferido está ocupado', async () => {
  const preferred = 43117
  const mounted: IUiDevAssets[] = []

  try {
    for (let i = 0; i < 3; i++) {
      mounted.push(await mountUiDevAssets(express(), stubBundler(), { liveReloadPort: preferred }))
    }

    const ports = mounted.map((m) => m.liveReloadPort)
    assert.equal(ports[0], preferred, 'the first app takes the preferred port')
    assert.deepEqual(
      [...new Set(ports)].length,
      ports.length,
      'apps started afterwards never share a port',
    )
    for (const port of ports) {
      assert.ok(port >= preferred && port < preferred + 20, `${port} is probed from the preferred`)
    }
  } finally {
    await Promise.all(mounted.map((m) => m.close()))
  }
})

test('cae a un puerto efímero cuando todo el rango probado está ocupado', async () => {
  const preferred = 43217
  const blockers: IUiDevAssets[] = []

  try {
    // One attempt only: the single probed port is taken, so the next mount has
    // nowhere left in range and must still come up.
    blockers.push(
      await mountUiDevAssets(express(), stubBundler(), {
        liveReloadPort: preferred,
        liveReloadPortAttempts: 1,
      }),
    )
    const fallback = await mountUiDevAssets(express(), stubBundler(), {
      liveReloadPort: preferred,
      liveReloadPortAttempts: 1,
    })
    blockers.push(fallback)

    assert.notEqual(fallback.liveReloadPort, preferred)
    assert.ok(fallback.liveReloadPort > 0, 'it still got a usable port')
  } finally {
    await Promise.all(blockers.map((b) => b.close()))
  }
})
