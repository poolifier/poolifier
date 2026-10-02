import { AsyncResource } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { vi } from 'vitest'

import { TaskRegistry } from '../../../lib/pools/task-registry.mjs'

export const selectedLease = { generation: 0, id: 1 }
export const currentLease = { generation: 0, id: 2 }

export const registerTask = ({
  abortSignal,
  onAbort = vi.fn(),
  reject = vi.fn(),
  resolve = vi.fn(),
  selected = selectedLease,
  taskId = randomUUID(),
} = {}) => {
  const asyncResource = new AsyncResource('task-registry-test', {
    requireManualDestroy: true,
  })
  const emitDestroy = vi.spyOn(asyncResource, 'emitDestroy')
  const registry = new TaskRegistry()
  registry.register({
    abortSignal,
    asyncResource,
    onAbort,
    reject,
    resolve,
    ...(selected != null && { selectedLease: selected }),
    task: { data: { taskId }, name: 'echo', taskId },
  })
  return {
    asyncResource,
    emitDestroy,
    onAbort,
    registry,
    reject,
    resolve,
    taskId,
  }
}
