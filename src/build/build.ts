import { existsSync, realpathSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import { scanProjectFiles } from '@/feature/project-runner/scanner'
import { isIslandFile, toIslandId } from '@/feature/ui-controller/island/IslandRegistry'
import { UiBundler } from '@/feature/ui-controller/bundler'
import { PreactRenderer } from '@/addon/ui/preact'
import { buildCssModuleSource } from '@/ui/cssModuleCompile'
import { generateEntry, generateIslandsRegistration, generateManifest } from './manifest'

/**
 * esbuild plugin so the bundled server resolves `*.module.css` to its scoped
 * class map (and registers its CSS) exactly like the SSR loader does in dev.
 * Plain `*.css` is a no-op on the server (injected client-side via <link>).
 */
const cssModulesPlugin: esbuild.Plugin = {
  name: 'wabot-css-modules',
  setup(build) {
    build.onLoad({ filter: /\.module\.css$/ }, async (args) => ({
      contents: await buildCssModuleSource(args.path),
      loader: 'js',
    }))
    build.onLoad({ filter: /\.css$/ }, async () => ({
      contents: 'export default ""',
      loader: 'js',
    }))
  },
}

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

  const islands = filesForManifest.filter(isIslandFile).map((absFile) => ({
    absFile,
    id: toIslandId(relative(cwd, absFile).split(sep).join('/')),
  }))
  const hasIslands = islands.length > 0

  const manifestSrc = generateManifest(filesForManifest, manifestDir)
  const entrySrc = generateEntry(manifestDir, entryResolved, FRAMEWORK_PACKAGE, hasIslands)

  await writeFile(resolve(manifestDir, 'manifest.ts'), manifestSrc, 'utf-8')
  await writeFile(resolve(manifestDir, 'entry.ts'), entrySrc, 'utf-8')
  if (hasIslands) {
    await writeFile(
      resolve(manifestDir, 'islands.ts'),
      generateIslandsRegistration(islands, manifestDir, FRAMEWORK_PACKAGE),
      'utf-8',
    )
  }

  try {
    await rm(outDir, { recursive: true, force: true })
    // Bundle the server with esbuild directly (not tsup): tsup ignores the JSX
    // runtime config and forces classic `React.createElement` (→ "React is not
    // defined" for views), and its CSS pipeline swallows `*.module.css`. esbuild
    // gives us the automatic JSX runtime and lets the CSS-module plugin run.
    await esbuild.build({
      entryPoints: [resolve(manifestDir, 'entry.ts')],
      outfile: resolve(outDir, 'entry.js'),
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node20',
      sourcemap,
      minify,
      jsx: 'automatic',
      jsxImportSource: 'preact',
      tsconfig: existsSync(resolve(cwd, 'tsconfig.json'))
        ? resolve(cwd, 'tsconfig.json')
        : undefined,
      external: config.external ?? ['pg'],
      plugins: [cssModulesPlugin],
      // ESM output: provide `require` so bundled CommonJS deps (e.g. `debug`,
      // which does `require('tty')`) work instead of hitting esbuild's dynamic
      // require shim.
      banner: {
        js: "import { createRequire as __wabotCreateRequire } from 'node:module'; const require = __wabotCreateRequire(import.meta.url);",
      },
      logLevel: 'warning',
    })

    // Emit island client bundles.
    if (hasIslands) {
      const uiOut = resolve(outDir, 'ui')
      const bundler = new UiBundler({
        islands: islands.map(({ absFile, id }) => ({
          id,
          importPath: absFile,
          relPath: relative(cwd, absFile).split(sep).join('/'),
        })),
        client: new PreactRenderer().client!,
        cwd,
      })
      const uiManifest = await bundler.buildProd(uiOut)
      await writeFile(resolve(uiOut, 'manifest.json'), JSON.stringify(uiManifest, null, 2), 'utf-8')
    }
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
