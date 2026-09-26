import { afterEach, expect } from 'vitest'

import { WorkerCrashError } from '../../lib/index.mjs'
import { createPoolCleanup } from './crash-recovery-utils.mjs'

export const createCrashRecoveryTestContext = () => {
  const { cleanupPools, trackPool } = createPoolCleanup()
  afterEach(cleanupPools)

  return {
    expectWorkerCrashErrorForWorker: (error, workerId) => {
      expect(error).toBeInstanceOf(WorkerCrashError)
      expect(error.name).toBe('WorkerCrashError')
      expect(error.workerId).toBe(workerId)
      expect(error.taskId).toBeDefined()
    },
    trackPool,
  }
}
