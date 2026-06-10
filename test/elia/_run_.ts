import { run } from '@'
import './EliaEventMemoryQueries'
import './EliaEventPgQueries'

run({
  directories: ['test/elia'],
  // Files that have a main() at module top level and must only run when
  // explicitly invoked (via their own package.json script). The framework's
  // scanner imports every other .ts file in the directory as part of the
  // bot, which would auto-execute these scripts and kill the process.
  exclude: ['_hubspot_sandbox_.ts', '_hubspot_smoke_.ts'],
})
