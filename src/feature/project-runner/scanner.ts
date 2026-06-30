import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export interface IScanProjectFilesOptions {
  directories?: string[]
  exclude?: string[]
}

const TEST_FILE_PATTERNS = /\.(test|spec|unit|integration|e2e|multiprocess)\.(ts|js)$/
const DEFAULT_DIRECTORIES = ['src']
const DEFAULT_EXCLUDE = ['_run_.ts', '_cmd_.ts']

export async function scanProjectFiles(opts: IScanProjectFilesOptions = {}): Promise<string[]> {
  const directories = opts.directories ?? DEFAULT_DIRECTORIES
  const exclude = [...DEFAULT_EXCLUDE, ...(opts.exclude ?? [])]

  const seen = new Set<string>()
  const roots = directories
    .map((d) => resolve(d))
    .filter((d) => {
      if (seen.has(d)) return false
      seen.add(d)
      return true
    })

  const excludedNames = new Set<string>()
  const excludedPathsByRoot = new Map<string, Set<string>>()
  for (const entry of exclude) {
    if (entry.includes('/') || entry.includes('\\')) {
      for (const root of roots) {
        let paths = excludedPathsByRoot.get(root)
        if (!paths) {
          paths = new Set()
          excludedPathsByRoot.set(root, paths)
        }
        paths.add(resolve(root, entry))
      }
    } else {
      excludedNames.add(entry)
    }
  }

  const results = await Promise.all(
    roots.map((dir) => {
      const excludedPaths = excludedPathsByRoot.get(dir) ?? new Set<string>()
      return scanDir(dir, excludedNames, excludedPaths).catch(() => [] as string[])
    }),
  )
  return results.flat()
}

async function scanDir(
  dir: string,
  excludedNames: Set<string>,
  excludedPaths: Set<string>,
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const subResults = await Promise.all(
    entries.map(async (entry) => {
      const name = entry.name
      const fullPath = join(dir, name)
      if (excludedNames.has(name)) return []
      if (excludedPaths.has(fullPath)) return []
      if (entry.isDirectory()) {
        if (name.startsWith('__')) return []
        return scanDir(fullPath, excludedNames, excludedPaths)
      }
      if (!entry.isFile()) return []
      if (!/\.(ts|tsx|js|jsx)$/.test(name)) return []
      if (name.endsWith('.d.ts')) return []
      if (TEST_FILE_PATTERNS.test(fullPath)) return []
      return [fullPath]
    }),
  )
  return subResults.flat()
}
