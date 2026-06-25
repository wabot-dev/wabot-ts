import { run } from '@'
import './EliaEventMemoryQueries'
import './EliaEventPgQueries'

run({
  directories: ['test/elia'],
})
