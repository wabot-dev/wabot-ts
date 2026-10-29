import test from 'node:test'
import assert from 'node:assert/strict'
import type { Pool, PoolClient } from 'pg'

import { runDetached } from '@/core/async-scope'
import { getPgClient, withPgClient } from './withPgClient'

interface IFakeClient {
  id: number
  released: boolean
  release(): void
}

// A pool that hands out numbered clients and records which ones were released.
function fakePool() {
  const clients: IFakeClient[] = []
  const pool = {
    clients,
    async connect() {
      const client: IFakeClient = {
        id: clients.length + 1,
        released: false,
        release() {
          this.released = true
        },
      }
      clients.push(client)
      return client
    },
  }
  return pool as unknown as Pool & { clients: IFakeClient[] }
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('nested calls reuse the client of the enclosing call', async () => {
  const pool = fakePool()
  await withPgClient(pool, async (outer) => {
    await withPgClient(pool, async (inner) => assert.equal(inner, outer))
    assert.equal(getPgClient(pool), outer)
  })
  assert.equal(pool.clients.length, 1)
  assert.ok(pool.clients[0].released)
})

test('calls running at the same time get their own client', async () => {
  // Like two requests served at once: siblings, not nested.
  const pool = fakePool()
  const aStarted = deferred()
  const aDone = deferred()
  let aClient: PoolClient | null = null
  let bClient: PoolClient | null = null

  const a = withPgClient(pool, async (client) => {
    aClient = client
    aStarted.resolve()
    await aDone.promise
  })
  await aStarted.promise
  await withPgClient(pool, async (client) => {
    bClient = client
    assert.equal(getPgClient(pool), client)
  })
  aDone.resolve()
  await a

  assert.ok(aClient && bClient)
  assert.notEqual(aClient, bClient)
  assert.equal(pool.clients.length, 2)
})

test('a call that outlives a sibling keeps its client until it ends', async () => {
  // The short call ending must not release the client the long one is using.
  const pool = fakePool()
  const shortStarted = deferred()
  const shortDone = deferred()
  const longStarted = deferred()
  const longDone = deferred()

  const short = withPgClient(pool, async () => {
    shortStarted.resolve()
    await shortDone.promise
  })
  await shortStarted.promise
  const long = withPgClient(pool, async (client) => {
    longStarted.resolve()
    await longDone.promise
    return (client as unknown as IFakeClient).released
  })
  await longStarted.promise
  shortDone.resolve()
  await short
  longDone.resolve()

  assert.equal(await long, false)
})

test('work left running after a call does not get its released client', async () => {
  const pool = fakePool()
  let later: Promise<PoolClient | Pool> | null = null
  await withPgClient(pool, async () => {
    later = sleep(5).then(() => getPgClient(pool))
  })
  assert.equal(await later, pool)

  let fresh: Promise<PoolClient> | null = null
  await withPgClient(pool, async () => {
    fresh = sleep(5).then(() => withPgClient(pool, async (client) => client))
  })
  const client = (await fresh!) as unknown as IFakeClient
  assert.equal(client.id, 3)
  assert.ok(client.released)
})

test('a nested call that outlives the call that acquired the client keeps it until it ends', async () => {
  // Work started without awaiting it, still running when its starter returns.
  const pool = fakePool()
  const nestedDone = deferred()
  let nested: Promise<boolean> | null = null

  await withPgClient(pool, async (outer) => {
    nested = withPgClient(pool, async (client) => {
      assert.equal(client, outer)
      await nestedDone.promise
      return (client as unknown as IFakeClient).released
    })
  })
  assert.equal(pool.clients[0].released, false)

  nestedDone.resolve()
  assert.equal(await nested!, false)
  assert.ok(pool.clients[0].released)
  assert.equal(pool.clients.length, 1)
})

test('work started through runDetached gets a client of its own', async () => {
  // Like the jobs the scheduler loop starts inside its lock: still running when
  // the lock's call gives its client back.
  const pool = fakePool()
  const jobDone = deferred()
  let job: Promise<IFakeClient> | null = null

  await withPgClient(pool, async (lock) => {
    job = runDetached(() =>
      withPgClient(pool, async (client) => {
        assert.notEqual(client, lock)
        assert.equal(getPgClient(pool), client)
        await jobDone.promise
        return client as unknown as IFakeClient
      }),
    )
  })
  assert.ok(pool.clients[0].released)

  jobDone.resolve()
  const client = await job!
  assert.equal(client.id, 2)
  assert.ok(client.released)
})

test('a client of one pool stays reachable inside a call on another pool', async () => {
  const first = fakePool()
  const second = fakePool()
  await withPgClient(first, async (a) => {
    await withPgClient(second, async (b) => {
      assert.equal(getPgClient(first), a)
      assert.equal(getPgClient(second), b)
    })
    assert.equal(getPgClient(first), a)
    assert.equal(getPgClient(second), second)
  })
})
