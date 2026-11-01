import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer, type AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { waitUntil } from '@/testing/helpers'

// Bundles a minimal app with the build script the package ships and runs it the
// way `npm start` does, against the framework as consumers install it (dist/).
// Run `npm run build` first.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const APP_FILES: Record<string, string> = {
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      strict: true,
      module: 'esnext',
      target: 'es2022',
      moduleResolution: 'bundler',
      esModuleInterop: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      isolatedModules: true,
      verbatimModuleSyntax: false,
      jsx: 'react-jsx',
      jsxImportSource: '@wabot-dev/framework/ui',
      skipLibCheck: true,
      paths: { '@/*': ['./src/*'] },
    },
    include: ['src'],
  }),
  'src/_run_.ts': `
import { run, IProjectRunnerConfig } from '@wabot-dev/framework'

export const config: IProjectRunnerConfig = {}

export default config

if (process.env.WABOT_BUNDLED !== '1') {
  run(config)
}
`,
  'src/Greeting.ts': `
import { injectable } from '@wabot-dev/framework'

@injectable()
export class Greeting {
  text(name: string) {
    return 'hola ' + name
  }
}
`,
  'src/HelloController.ts': `
import { restController, onGet } from '@wabot-dev/framework'
import { Greeting } from './Greeting'

@restController('/hello')
export class HelloController {
  constructor(private greeting: Greeting) {}

  @onGet()
  hello() {
    return { text: this.greeting.text('mundo') }
  }
}
`,
  'src/PageController.tsx': `
import { uiController, view, isString } from '@wabot-dev/framework'

export class PageParams {
  @isString()
  name!: string
}

@uiController('/page')
export class PageController {
  @view(':name')
  show(params: PageParams) {
    return <p id="name">{params.name}</p>
  }
}
`,
}

/** Writes the app into a temp dir with the framework installed as a package. */
async function createApp(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'wabot-bundle-'))
  for (const [file, content] of Object.entries(APP_FILES)) {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true })
    await writeFile(path.join(dir, file), content)
  }
  const modules = path.join(dir, 'node_modules')
  await mkdir(path.join(modules, '@wabot-dev'), { recursive: true })
  await symlink(repoRoot, path.join(modules, '@wabot-dev/framework'), 'dir')
  for (const name of await readdir(path.join(repoRoot, 'node_modules'))) {
    if (name === '@wabot-dev') continue
    await symlink(path.join(repoRoot, 'node_modules', name), path.join(modules, name), 'dir')
  }
  return dir
}

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  await new Promise((resolve) => server.close(resolve))
  return port
}

function runNode(args: string[], cwd: string): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd })
    let output = ''
    child.stdout.on('data', (d) => (output += d))
    child.stderr.on('data', (d) => (output += d))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, output }))
  })
}

test.describe('build empaquetado', () => {
  let appDir = ''
  let baseUrl = ''
  let server: ReturnType<typeof spawn> | null = null
  let serverOutput = ''

  test.before(async () => {
    const buildScript = path.join(repoRoot, 'dist/build/build.js')
    assert.ok(existsSync(buildScript), `${buildScript} no existe: corre npm run build primero`)

    appDir = await createApp()
    const build = await runNode(['node_modules/@wabot-dev/framework/dist/build/build.js'], appDir)
    assert.equal(build.code, 0, build.output)

    const port = await freePort()
    baseUrl = `http://127.0.0.1:${port}`
    // Only what `npm start` sets: a DATABASE_URL or API key from the shell
    // must not change what boots.
    server = spawn(process.execPath, ['dist/entry.js'], {
      cwd: appDir,
      env: { PATH: process.env.PATH, WABOT_BUNDLED: '1', PORT: String(port) },
    })
    server.stdout!.on('data', (d) => (serverOutput += d))
    server.stderr!.on('data', (d) => (serverOutput += d))

    await waitUntil(
      async () => {
        if (server!.exitCode !== null) throw new Error(`el bundle terminó:\n${serverOutput}`)
        return fetch(`${baseUrl}/hello`).then(
          () => true,
          () => false,
        )
      },
      30_000,
      100,
    )
  })

  test.after(async () => {
    server?.kill()
    if (appDir) await rm(appDir, { recursive: true, force: true })
  })

  test('inyecta las dependencias del constructor de un controlador', async () => {
    const res = await fetch(`${baseUrl}/hello`)

    assert.equal(res.status, 200, serverOutput)
    assert.deepEqual(await res.json(), { text: 'hola mundo' })
  })

  test('entrega el DTO a una vista', async () => {
    const res = await fetch(`${baseUrl}/page/ana`)

    assert.equal(res.status, 200, serverOutput)
    assert.match(await res.text(), /<p id="name">ana<\/p>/)
  })
})
