import { describe, expect, it } from 'vitest'

import { WorkerUsageStore } from '../../../lib/pools/worker-usage-store.mjs'
import { PriorityQueue } from '../../../lib/queues/priority-queue.mjs'
import { DEFAULT_TASK_NAME } from '../../../lib/utils.mjs'

const createStore = () => {
  const queue = new PriorityQueue(4, true)
  const info = {
    taskFunctionsProperties: [
      { name: DEFAULT_TASK_NAME },
      { name: 'default-handler' },
      { name: 'secondary-handler' },
    ],
  }
  return { queue, store: new WorkerUsageStore(info, queue) }
}

describe('WorkerUsageStore', () => {
  it('owns aggregate worker usage with live queue projections', () => {
    // Given
    const { queue, store } = createStore()

    // When
    queue.enqueue({ name: 'secondary-handler' })

    // Then
    expect(store.usage.tasks.queued).toBe(1)
    expect(store.usage.tasks.maxQueued).toBe(1)
    expect(store.usage.tasks.executed).toBe(0)
  })

  it('resolves the default task name and caches one usage record', () => {
    // Given
    const { store } = createStore()

    // When
    const byDefaultName = store.getTaskFunctionWorkerUsage(DEFAULT_TASK_NAME)
    const byResolvedName = store.getTaskFunctionWorkerUsage('default-handler')

    // Then
    expect(byDefaultName).toBe(byResolvedName)
  })

  it('projects queued tasks for only the selected task function', () => {
    // Given
    const { queue, store } = createStore()
    queue.enqueue({ name: DEFAULT_TASK_NAME })
    queue.enqueue({ name: 'secondary-handler' })

    // When
    const defaultUsage = store.getTaskFunctionWorkerUsage('default-handler')
    const secondaryUsage = store.getTaskFunctionWorkerUsage('secondary-handler')

    // Then
    expect(defaultUsage.tasks.queued).toBe(1)
    expect(secondaryUsage.tasks.queued).toBe(1)
  })

  it('deletes only the requested task-function usage record', () => {
    // Given
    const { store } = createStore()
    store.getTaskFunctionWorkerUsage('default-handler')
    store.getTaskFunctionWorkerUsage('secondary-handler')

    // When
    const deleted = store.deleteTaskFunctionWorkerUsage('default-handler')

    // Then
    expect(deleted).toBe(true)
    expect(store.deleteTaskFunctionWorkerUsage('default-handler')).toBe(false)
    expect(store.getTaskFunctionWorkerUsage('secondary-handler')).toBeDefined()
  })
})
