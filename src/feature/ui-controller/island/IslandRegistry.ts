import { createHash } from 'node:crypto'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { isIsland, setIslandId } from './island'

export interface IDiscoveredIsland {
  /** Stable id derived from the file's project-relative path. */
  id: string
  /** Absolute path to the island source module. */
  importPath: string
  /** Project-relative posix path (the basis of the id). */
  relPath: string
}

/** Files matching this are treated as islands (default export wrapped with island()). */
export const ISLAND_FILE_PATTERN = /\.island\.(tsx|jsx)$/

/** Deterministic, readable, collision-resistant id from a project-relative path. */
export function toIslandId(relPath: string): string {
  const base =
    path
      .basename(relPath)
      .replace(ISLAND_FILE_PATTERN, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_') || 'island'
  const hash = createHash('sha1').update(relPath).digest('hex').slice(0, 8)
  return `${base}-${hash}`
}

export function isIslandFile(file: string): boolean {
  return ISLAND_FILE_PATTERN.test(file)
}

/**
 * Discovers `*.island.tsx` modules, assigns each a stable id, and stamps that
 * id onto the imported island component (ESM module singletons mean the view
 * renders the same instance, so the renderer can read the id during SSR).
 */
@singleton()
export class IslandRegistry {
  private islands = new Map<string, IDiscoveredIsland>()
  private logger = new Logger('wabot:ui:islands')

  async discover(files: string[], cwd: string = process.cwd()): Promise<IDiscoveredIsland[]> {
    for (const absPath of files.filter(isIslandFile)) {
      const relPath = path.relative(cwd, absPath).split(path.sep).join('/')
      const id = toIslandId(relPath)
      try {
        const mod = await import(pathToFileURL(absPath).href)
        const component = mod.default
        if (!isIsland(component)) {
          this.logger.warn(`${relPath}: default export is not an island(); skipping`)
          continue
        }
        setIslandId(component, id)
        this.islands.set(id, { id, importPath: absPath, relPath })
      } catch (err) {
        this.logger.error(`Failed to load island ${relPath}`, err)
      }
    }
    return this.list()
  }

  register(island: IDiscoveredIsland): void {
    this.islands.set(island.id, island)
  }

  list(): IDiscoveredIsland[] {
    return [...this.islands.values()]
  }

  get(id: string): IDiscoveredIsland | undefined {
    return this.islands.get(id)
  }

  get size(): number {
    return this.islands.size
  }
}
