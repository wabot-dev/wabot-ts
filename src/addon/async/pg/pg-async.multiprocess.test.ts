import { describe } from 'node:test'
import { fileURLToPath } from 'url'

import { testAsync } from '@/feature/async/testAsync'
import './pg-async-test-injection'

const workerPath = fileURLToPath(new URL('./pg-async-test-worker.ts', import.meta.url))

describe('Pg-Async', () => {
  testAsync({ workerPath, numberOfWorkers: 3, localRun: false })
})
