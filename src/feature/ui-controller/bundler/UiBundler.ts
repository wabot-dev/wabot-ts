import path from 'node:path'
import * as esbuild from 'esbuild'
import { Logger } from '@/core/logger'
import { IDiscoveredIsland } from '../island'
import { IUiClientConfig } from '../renderer'
import {
  IUiManifest,
  ISLAND_ENTRY_NAMESPACE,
  emptyManifest,
  manifestFromMetafile,
} from './manifest'

export interface IServedFile {
  contents: Uint8Array
  type: string
}

export interface IUiBundlerOptions {
  islands: IDiscoveredIsland[]
  client: IUiClientConfig
  /** URL prefix assets are served under. Default "/_wabot/". */
  base?: string
  /** Project root used to resolve relative output paths. Default process.cwd(). */
  cwd?: string
  /** Extra esbuild import aliases (e.g. map the framework UI module to its client build). */
  alias?: Record<string, string>
}

function mimeFor(servePath: string): string {
  if (servePath.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (servePath.endsWith('.css')) return 'text/css; charset=utf-8'
  if (servePath.endsWith('.map')) return 'application/json; charset=utf-8'
  return 'application/octet-stream'
}

function entrySources(islands: IDiscoveredIsland[], client: IUiClientConfig): Map<string, string> {
  const sources = new Map<string, string>()
  for (const island of islands) {
    // keyed by bare id; esbuild records the entry as `${namespace}:${path}`.
    sources.set(
      island.id,
      client.islandEntrySource({ id: island.id, importPath: island.importPath }),
    )
  }
  return sources
}

function islandEntryPlugin(sources: Map<string, string>, cwd: string): esbuild.Plugin {
  const prefix = `${ISLAND_ENTRY_NAMESPACE}:`
  const filter = new RegExp(`^${ISLAND_ENTRY_NAMESPACE}:`)
  return {
    name: 'wabot-island-entries',
    setup(build) {
      build.onResolve({ filter }, (args) => ({
        path: args.path.slice(prefix.length),
        namespace: ISLAND_ENTRY_NAMESPACE,
      }))
      build.onLoad({ filter: /.*/, namespace: ISLAND_ENTRY_NAMESPACE }, (args) => ({
        contents: sources.get(args.path) ?? '',
        loader: 'js',
        resolveDir: cwd,
      }))
    },
  }
}

function baseBuildOptions(
  islands: IDiscoveredIsland[],
  client: IUiClientConfig,
  opts: { outdir: string; dev: boolean; cwd: string; alias?: Record<string, string> },
): esbuild.BuildOptions {
  const jsxMode = client.esbuildJsx?.jsx ?? 'automatic'
  return {
    entryPoints: islands.map((i) => ({ in: `${ISLAND_ENTRY_NAMESPACE}:${i.id}`, out: i.id })),
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    outdir: opts.outdir,
    absWorkingDir: opts.cwd,
    metafile: true,
    alias: opts.alias,
    sourcemap: opts.dev ? 'inline' : false,
    minify: !opts.dev,
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: 'assets/[name]-[hash]',
    jsx: jsxMode,
    ...(jsxMode === 'automatic'
      ? { jsxImportSource: client.esbuildJsx?.jsxImportSource }
      : {
          jsxFactory: client.esbuildJsx?.jsxFactory,
          jsxFragment: client.esbuildJsx?.jsxFragmentFactory,
        }),
    loader: { '.module.css': 'local-css' },
    logLevel: 'silent',
  }
}

/**
 * Bundles island client code with esbuild. In dev it watches and serves from
 * memory; in prod it writes hashed assets to disk and returns a manifest.
 */
export class UiBundler {
  private readonly islands: IDiscoveredIsland[]
  private readonly client: IUiClientConfig
  private readonly base: string
  private readonly cwd: string
  private readonly alias?: Record<string, string>
  private readonly logger = new Logger('wabot:ui:bundler')

  private ctx: esbuild.BuildContext | null = null
  private served = new Map<string, IServedFile>()
  private manifest: IUiManifest
  private rebuildListeners = new Set<() => void>()

  constructor(options: IUiBundlerOptions) {
    this.islands = options.islands
    this.client = options.client
    this.base = options.base ?? '/_wabot/'
    this.cwd = options.cwd ?? process.cwd()
    this.alias = options.alias
    this.manifest = emptyManifest(this.base)
  }

  /** Start a watching dev build; assets are kept in memory and served via getFile(). */
  async startDev(): Promise<void> {
    const outdir = path.resolve(this.cwd, '.wabot-ui-dev')
    const sources = entrySources(this.islands, this.client)
    const onEnd: esbuild.Plugin = {
      name: 'wabot-dev-refresh',
      setup: (build) => {
        build.onEnd((result) => {
          this.ingest(result, outdir)
          for (const listener of this.rebuildListeners) listener()
        })
      },
    }
    this.ctx = await esbuild.context({
      ...baseBuildOptions(this.islands, this.client, {
        outdir,
        dev: true,
        cwd: this.cwd,
        alias: this.alias,
      }),
      write: false,
      plugins: [islandEntryPlugin(sources, this.cwd), onEnd],
    })
    await this.ctx.rebuild()
    await this.ctx.watch()
    this.logger.info(`watching ${this.islands.length} island(s)`)
  }

  /** Build once and write hashed assets to outDir; returns the manifest. */
  async buildProd(outDir: string): Promise<IUiManifest> {
    const outdir = path.resolve(this.cwd, outDir)
    const sources = entrySources(this.islands, this.client)
    const result = await esbuild.build({
      ...baseBuildOptions(this.islands, this.client, {
        outdir,
        dev: false,
        cwd: this.cwd,
        alias: this.alias,
      }),
      write: true,
      plugins: [islandEntryPlugin(sources, this.cwd)],
    })
    this.manifest = manifestFromMetafile(result.metafile!, {
      base: this.base,
      outdir,
      cwd: this.cwd,
    })
    this.logger.info(`built ${this.islands.length} island(s) -> ${outDir}`)
    return this.manifest
  }

  private ingest(result: esbuild.BuildResult, outdir: string): void {
    this.served.clear()
    for (const file of result.outputFiles ?? []) {
      const rel = path.relative(outdir, file.path).split(path.sep).join('/')
      const servePath = this.base + rel
      this.served.set(servePath, { contents: file.contents, type: mimeFor(servePath) })
    }
    if (result.metafile) {
      this.manifest = manifestFromMetafile(result.metafile, {
        base: this.base,
        outdir,
        cwd: this.cwd,
      })
    }
  }

  getFile(servePath: string): IServedFile | undefined {
    return this.served.get(servePath)
  }

  getManifest(): IUiManifest {
    return this.manifest
  }

  onRebuild(listener: () => void): void {
    this.rebuildListeners.add(listener)
  }

  async dispose(): Promise<void> {
    await this.ctx?.dispose()
    this.ctx = null
  }
}
