import test from 'node:test'
import assert from 'node:assert/strict'
import { ProjectRunner, run } from './ProjectRunner'

function spyRun(impl: (this: ProjectRunner) => Promise<void> = async () => {}) {
  const original = ProjectRunner.prototype.run
  const instances: ProjectRunner[] = []
  ProjectRunner.prototype.run = async function (this: ProjectRunner) {
    instances.push(this)
    return impl.call(this)
  }
  return {
    get calls() {
      return instances.length
    },
    get instance() {
      return instances[instances.length - 1] ?? null
    },
    get instances() {
      return instances
    },
    restore() {
      ProjectRunner.prototype.run = original
    },
  }
}

function withEnv(key: string, value: string | undefined, fn: () => Promise<void>): Promise<void> {
  const previous = process.env[key]
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
  return fn().finally(() => {
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  })
}

test.describe('run', () => {
  test('returns a Promise', () => {
    const spy = spyRun()
    try {
      const result = run()
      assert.ok(result instanceof Promise)
      return result
    } finally {
      spy.restore()
    }
  })

  test('invokes ProjectRunner.run exactly once', async () => {
    const spy = spyRun()
    try {
      await run()
      assert.equal(spy.calls, 1)
    } finally {
      spy.restore()
    }
  })

  test('uses default directories when no config is provided', async () => {
    const spy = spyRun()
    try {
      await run()
      assert.deepEqual((spy.instance as any).directories, ['src'])
    } finally {
      spy.restore()
    }
  })

  test('forwards directories from config', async () => {
    const spy = spyRun()
    try {
      await run({ directories: ['a', 'b'] })
      assert.deepEqual((spy.instance as any).directories, ['a', 'b'])
    } finally {
      spy.restore()
    }
  })

  test('forwards chatAdapters from config (including empty array)', async () => {
    const spy = spyRun()
    try {
      await run({ chatAdapters: [] })
      assert.deepEqual((spy.instance as any).chatAdapters, [])
    } finally {
      spy.restore()
    }
  })

  test('forwards connectionString from config', async () => {
    const spy = spyRun()
    try {
      await run({ connectionString: 'postgres://localhost/x' })
      assert.equal((spy.instance as any).connectionString, 'postgres://localhost/x')
    } finally {
      spy.restore()
    }
  })

  test('falls back to DATABASE_URL env when connectionString not in config', async () => {
    const spy = spyRun()
    try {
      await withEnv('DATABASE_URL', 'postgres://env-host/db', async () => {
        await run()
        assert.equal((spy.instance as any).connectionString, 'postgres://env-host/db')
      })
    } finally {
      spy.restore()
    }
  })

  test('config connectionString takes precedence over env', async () => {
    const spy = spyRun()
    try {
      await withEnv('DATABASE_URL', 'postgres://env/db', async () => {
        await run({ connectionString: 'postgres://config/db' })
        assert.equal((spy.instance as any).connectionString, 'postgres://config/db')
      })
    } finally {
      spy.restore()
    }
  })

  test('connectionString is null when neither config nor env provides one', async () => {
    const spy = spyRun()
    try {
      await withEnv('DATABASE_URL', undefined, async () => {
        await run()
        assert.equal((spy.instance as any).connectionString, null)
      })
    } finally {
      spy.restore()
    }
  })

  test('propagates rejection from ProjectRunner.run', async () => {
    const spy = spyRun(async () => {
      throw new Error('boom')
    })
    try {
      await assert.rejects(run(), { message: 'boom' })
    } finally {
      spy.restore()
    }
  })

  test('run(undefined) behaves the same as run() with no args', async () => {
    const spy = spyRun()
    try {
      await run(undefined)
      assert.equal(spy.calls, 1)
      assert.deepEqual((spy.instance as any).directories, ['src'])
      assert.equal((spy.instance as any).chatAdapters, undefined)
      assert.equal((spy.instance as any).connectionString, null)
    } finally {
      spy.restore()
    }
  })

  test('empty directories array is preserved (not replaced with default)', async () => {
    const spy = spyRun()
    try {
      await run({ directories: [] })
      assert.deepEqual((spy.instance as any).directories, [])
    } finally {
      spy.restore()
    }
  })

  test('explicit chatAdapters: undefined is preserved as undefined', async () => {
    const spy = spyRun()
    try {
      await run({ chatAdapters: undefined })
      assert.equal((spy.instance as any).chatAdapters, undefined)
    } finally {
      spy.restore()
    }
  })

  test('recognizes postgres:// scheme as Postgres (isPg=true)', async () => {
    const spy = spyRun()
    try {
      await run({ connectionString: 'postgres://host/db' })
      assert.equal((spy.instance as any).isPg, true)
    } finally {
      spy.restore()
    }
  })

  test('recognizes postgresql:// scheme as Postgres (isPg=true)', async () => {
    const spy = spyRun()
    try {
      await run({ connectionString: 'postgresql://host/db' })
      assert.equal((spy.instance as any).isPg, true)
    } finally {
      spy.restore()
    }
  })

  test('non-Postgres connectionString is stored but isPg is false', async () => {
    const spy = spyRun()
    try {
      await run({ connectionString: 'mysql://host/db' })
      assert.equal((spy.instance as any).connectionString, 'mysql://host/db')
      assert.equal((spy.instance as any).isPg, false)
    } finally {
      spy.restore()
    }
  })

  test('isPg is false when no connection string is provided', async () => {
    const spy = spyRun()
    try {
      await withEnv('DATABASE_URL', undefined, async () => {
        await run()
        assert.equal((spy.instance as any).isPg, false)
      })
    } finally {
      spy.restore()
    }
  })

  test('connection-string prefix match is exact (does not match "postgres-fake://")', async () => {
    const spy = spyRun()
    try {
      await run({ connectionString: 'postgres-fake://host/db' })
      assert.equal((spy.instance as any).isPg, false)
    } finally {
      spy.restore()
    }
  })

  test('does not mutate the input config object', async () => {
    const spy = spyRun()
    try {
      const directories = ['a', 'b']
      const chatAdapters: any[] = []
      const config = Object.freeze({
        directories,
        chatAdapters,
        connectionString: 'postgres://host/db',
      })
      await run(config)
      assert.equal(config.directories, directories)
      assert.equal(config.chatAdapters, chatAdapters)
      assert.deepEqual(config.directories, ['a', 'b'])
    } finally {
      spy.restore()
    }
  })

  test('sequential run() calls each create a fresh ProjectRunner', async () => {
    const spy = spyRun()
    try {
      await run({ directories: ['first'] })
      await run({ directories: ['second'] })
      assert.equal(spy.calls, 2)
      assert.notEqual(spy.instances[0], spy.instances[1])
      assert.deepEqual((spy.instances[0] as any).directories, ['first'])
      assert.deepEqual((spy.instances[1] as any).directories, ['second'])
    } finally {
      spy.restore()
    }
  })

  test('concurrent run() calls each create their own ProjectRunner', async () => {
    const spy = spyRun()
    try {
      await Promise.all([
        run({ directories: ['a'] }),
        run({ directories: ['b'] }),
        run({ directories: ['c'] }),
      ])
      assert.equal(spy.calls, 3)
      const dirs = spy.instances.map((i) => (i as any).directories[0]).sort()
      assert.deepEqual(dirs, ['a', 'b', 'c'])
      assert.equal(new Set(spy.instances).size, 3)
    } finally {
      spy.restore()
    }
  })

  test('propagates synchronous-style throws from ProjectRunner.run', async () => {
    const spy = spyRun(() => {
      throw new Error('sync-boom')
    })
    try {
      await assert.rejects(run(), { message: 'sync-boom' })
    } finally {
      spy.restore()
    }
  })

  test('rejection in one concurrent call does not prevent the others from running', async () => {
    let count = 0
    const spy = spyRun(async function () {
      const i = ++count
      if (i === 2) throw new Error('only-second-fails')
    })
    try {
      const results = await Promise.allSettled([run(), run(), run()])
      assert.equal(results[0].status, 'fulfilled')
      assert.equal(results[1].status, 'rejected')
      assert.equal(results[2].status, 'fulfilled')
      assert.equal(spy.calls, 3)
    } finally {
      spy.restore()
    }
  })
})
