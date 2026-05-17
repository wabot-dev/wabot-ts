import { existsSync, realpathSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanProjectFiles } from '@/feature/project-runner/scanner'
import { generateEntry, generateManifest } from './manifest'

export interface IBuildConfig {
  entry?: string
  directories?: string[]
  exclude?: string[]
  outDir?: string
  sourcemap?: boolean
  minify?: boolean
  external?: string[]
}

const FRAMEWORK_PACKAGE = '@wabot-dev/framework'
const MANIFEST_DIRNAME = '.wabot'

async function readJsonIfExists<T = unknown>(path: string): Promise<T | null> {
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf-8')
  return JSON.parse(raw) as T
}

export async function loadBuildConfig(cwd: string): Promise<IBuildConfig> {
  const fromFile = await readJsonIfExists<IBuildConfig>(resolve(cwd, 'wabot.build.json'))
  if (fromFile) return fromFile
  const pkg = await readJsonIfExists<{ wabot?: IBuildConfig }>(resolve(cwd, 'package.json'))
  return pkg?.wabot ?? {}
}

function absolutize(cwd: string, p: string): string {
  return isAbsolute(p) ? p : resolve(cwd, p)
}

export interface IBuildOptions {
  cwd?: string
  keep?: boolean
}

export async function runBuild(options: IBuildOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd()
  const config = await loadBuildConfig(cwd)

  const entry = config.entry ? absolutize(cwd, config.entry) : absolutize(cwd, './src/_run_.ts')
  const directories = config.directories ?? ['src']
  const exclude = config.exclude ?? []
  const outDir = absolutize(cwd, config.outDir ?? './dist')
  const sourcemap = config.sourcemap ?? true
  const minify = config.minify ?? false

  const manifestDir = resolve(cwd, MANIFEST_DIRNAME)
  await mkdir(manifestDir, { recursive: true })

  const prevCwd = process.cwd()
  let discovered: string[]
  try {
    process.chdir(cwd)
    discovered = await scanProjectFiles({ directories, exclude })
  } finally {
    process.chdir(prevCwd)
  }

  const entryResolved = existsSync(entry) ? entry : null
  const filesForManifest = discovered.filter((f) => f !== entry)

  const manifestSrc = generateManifest(filesForManifest, manifestDir)
  const entrySrc = generateEntry(manifestDir, entryResolved, FRAMEWORK_PACKAGE)

  await writeFile(resolve(manifestDir, 'manifest.ts'), manifestSrc, 'utf-8')
  await writeFile(resolve(manifestDir, 'entry.ts'), entrySrc, 'utf-8')

  let tsup: typeof import('tsup')
  try {
    tsup = await import('tsup')
  } catch {
    throw new Error(
      `tsup is not installed in the consumer project. Install it as a dev dependency: npm i -D tsup`,
    )
  }

  try {
    await tsup.build({
      entry: [resolve(manifestDir, 'entry.ts')],
      format: ['esm'],
      outDir,
      clean: true,
      sourcemap,
      minify,
      splitting: false,
      bundle: true,
      target: 'node20',
      tsconfig: existsSync(resolve(cwd, 'tsconfig.json'))
        ? resolve(cwd, 'tsconfig.json')
        : undefined,
      external: config.external ?? ['pg'],
    })
  } finally {
    if (!options.keep) {
      await rm(manifestDir, { recursive: true, force: true })
    }
  }
}

function isMainModule(): boolean {
  const argvEntry = process.argv[1]
  if (!argvEntry) return false
  try {
    return realpathSync(argvEntry) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isMainModule()) {
  const keep = process.argv.includes('--keep')
  runBuild({ keep }).catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
