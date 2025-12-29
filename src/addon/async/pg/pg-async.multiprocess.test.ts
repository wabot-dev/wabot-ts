import { testRunCommmand } from '@/feature/async/testRunCommand'
import { describe } from 'node:test'
import { fileURLToPath } from 'url'

import './pg-async-test-injection'

const workerPath = fileURLToPath(new URL('./pg-async-test-worker.ts', import.meta.url))

describe('Pg-Async', () => {
  testRunCommmand({ workerPath })
})
