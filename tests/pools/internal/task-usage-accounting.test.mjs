import { describe, expect, it, vi } from 'vitest'

import { TaskUsageAccounting } from '../../../lib/pools/task-usage-accounting.mjs'

const usage = () => ({
  tasks: {
    executed: 0,
    executing: 0,
    failed: 0,
    sequentiallyStolen: 0,
    stolen: 0,
  },
})
const node = (id, taskFunctions = 3) => {
  const taskUsage = usage()
  return {
    getTaskFunctionWorkerUsage: name =>
      name === 'default' ? taskUsage : undefined,
    info: {
      id,
      taskFunctionsProperties: Array.from({ length: taskFunctions }),
    },
    taskUsage,
    usage: usage(),
  }
}

describe('TaskUsageAccounting', () => {
  it('accounts a stolen completion to the selected lease and decrements the active lease', () => {
    const selected = node(1)
    const active = node(2)
    active.usage.tasks.executing = 1
    active.taskUsage.tasks.executing = 1
    const updated = []
    const accounting = new TaskUsageAccounting({
      getWorkerNodeKeyByLease: lease =>
        lease?.id === 1 ? 0 : lease?.id === 2 ? 1 : -1,
      updateStrategy: key => updated.push(key),
      workerNodes: () => [selected, active],
    })

    accounting.applyRejectedSettlement({
      effect: {
        activeLease: { generation: 1, id: 2 },
        executionStarted: true,
        selectedLease: { generation: 1, id: 1 },
        taskName: 'default',
      },
      secondaryErrors: [],
      settled: true,
    })

    expect(active.usage.tasks.executing).toBe(0)
    expect(active.taskUsage.tasks.executing).toBe(0)
    expect(selected.usage.tasks.failed).toBe(1)
    expect(selected.taskUsage.tasks.failed).toBe(1)
    expect(updated).toEqual([1, 0])
  })

  it('runs metric callbacks in current AbstractPool order', () => {
    const worker = node(1)
    worker.usage.tasks.executing = 1
    const calls = []
    const accounting = new TaskUsageAccounting({
      getWorkerNodeKeyByLease: () => 0,
      updateElu: target =>
        calls.push(target === worker.usage ? 'worker-elu' : 'task-elu'),
      updateRunTime: target =>
        calls.push(target === worker.usage ? 'worker-run' : 'task-run'),
      updateStrategy: () => calls.push('strategy'),
      workerNodes: () => [worker],
    })

    accounting.afterExecution(0, { taskPerformance: { name: 'default' } }, 0)

    expect(worker.usage.tasks.executing).toBe(0)
    expect(worker.usage.tasks.executed).toBe(1)
    expect(calls).toEqual([
      'worker-run',
      'worker-elu',
      'task-run',
      'task-elu',
      'strategy',
    ])
  })

  it('preserves sequential steal reset and increment values', () => {
    const worker = node(1)
    const accounting = new TaskUsageAccounting({
      getWorkerNodeKeyByLease: vi.fn(),
      workerNodes: () => [worker],
    })

    accounting.updateSequentiallyStolen(0, 'default')
    accounting.updateSequentiallyStolen(0, 'default', 'default')
    accounting.updateSequentiallyStolen(0, 'default', 'other')

    expect(worker.usage.tasks.sequentiallyStolen).toBe(3)
    expect(worker.taskUsage.tasks.sequentiallyStolen).toBe(0)
  })
})
