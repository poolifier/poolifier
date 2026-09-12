import { vi } from 'vitest'

export const signal = new AbortController().signal

export const createCallbacks = () => ({
  apply: vi.fn(),
  attemptRestart: vi.fn(() => true),
  createDynamic: vi.fn(),
  defer: vi.fn(),
  detachQueued: vi.fn(),
  drainPhysical: vi.fn(),
  executionFinished: vi.fn(),
  isRunning: vi.fn(() => true),
  keyOf: vi.fn(() => 0),
  publishError: vi.fn(),
  reject: vi.fn(() => true),
  replenishFixed: vi.fn(),
  reserve: vi.fn((taskIds, lease) =>
    taskIds.map(taskId => ({
      lease,
      previousState: 'running',
      taskId,
    }))
  ),
  restartWorkerOnError: vi.fn(() => true),
  restore: vi.fn(() => []),
  rollbackStartup: vi.fn(),
  taskDequeued: vi.fn(),
  tasksFinishedTimeout: vi.fn(() => 2000),
  waitForDrain: vi.fn(() => Promise.resolve()),
  workers: vi.fn(() => []),
})
