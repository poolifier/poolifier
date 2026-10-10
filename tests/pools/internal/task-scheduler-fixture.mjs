import { vi } from 'vitest'

import { TaskRegistry } from '../../../lib/pools/task-registry.mjs'
import { TaskScheduler } from '../../../lib/pools/task-scheduler.mjs'

export const createFixture = ({ acquire = true } = {}) => {
  const registry = new TaskRegistry()
  const queue = []
  const worker = {
    deleteTask: task => {
      const index = queue.indexOf(task)
      if (index === -1) return false
      queue.splice(index, 1)
      return true
    },
    dequeueLastPrioritizedTask: () => queue.pop(),
    dequeueTask: () => queue.shift(),
    enqueueTask: task => queue.push(task),
    tasksQueueSize: () => queue.length,
  }
  const handle = { lease: { generation: 1, id: 1 }, worker }
  const permit = { handle, readiness: 'ready' }
  const send = vi.fn()
  const sendAbort = vi.fn()
  const scheduler = new TaskScheduler(registry, {
    acquire: candidate =>
      acquire && candidate === handle ? permit : undefined,
    candidates: () => [handle],
    send,
    sendAbort,
    shouldDispatch: () => true,
  })
  const register = (taskId, abortSignal) => {
    const reject = vi.fn()
    const resolve = vi.fn()
    registry.register({
      abortSignal,
      asyncResource: undefined,
      onAbort: () => undefined,
      reject,
      resolve,
      selectedLease: handle.lease,
      task: { name: 'default', taskId },
    })
    return { reject, resolve }
  }
  return {
    handle,
    permit,
    queue,
    register,
    registry,
    scheduler,
    send,
    sendAbort,
    worker,
  }
}
