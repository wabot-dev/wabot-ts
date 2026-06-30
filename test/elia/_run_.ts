import { resolve } from 'node:path'
import { run } from '@'
import './EliaEventMemoryQueries'
import './EliaEventPgQueries'

run({
  directories: ['test/elia'],
  // In-repo only: islands here import the framework UI via the "@/ui" path
  // alias, so point the island bundler at the client build. Real consumers
  // import "@wabot-dev/framework/ui" and don't need this.
  ui: { bundlerAlias: { '@/ui': resolve('src/ui/client.ts') } },
})
