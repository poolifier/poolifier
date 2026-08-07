/* eslint-disable n/no-unsupported-features/node-builtins -- async_hooks is required to verify resource destruction. */
import { createHook } from 'node:async_hooks'

import { FixedThreadPool, PoolEvents } from '../../../lib/index.mjs'

const liveResources = new Map()
const hook = createHook({
  destroy: asyncId => {
    liveResources.delete(asyncId)
  },
  init: (asyncId, type) => {
    if (type === 'Timeout' || type === 'WORKER') {
      liveResources.set(asyncId, type)
    }
  },
})
hook.enable()

const count = type =>
  [...liveResources.values()].filter(resourceType => resourceType === type)
    .length

await new Promise(resolve => setImmediate(resolve))
const baselineTimeouts = count('Timeout')
const baselineWorkers = count('WORKER')
const taskAccounting = []
const cycles = 5

for (let cycle = 0; cycle < cycles; cycle++) {
  const pool = new FixedThreadPool(
    6,
    './tests/worker-files/thread/testWorker.mjs',
    {
      enableTasksQueue: true,
      tasksQueueOptions: {
        concurrency: 1,
        taskStealing: true,
      },
    }
  )
  if (!pool.info.ready) {
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
  }
  await Promise.all(
    Array.from({ length: 18 }, (_, index) => pool.execute({ f: index }))
  )
  taskAccounting.push({
    active: pool.workerNodes.map(
      workerNode => workerNode.usage.tasks.executing
    ),
    historical: pool.workerNodes.map(
      workerNode => workerNode.usage.tasks.executed
    ),
  })
  await pool.destroy()
}

for (let turn = 0; turn < 20; turn++) {
  await new Promise(resolve => setImmediate(resolve))
}

process.stdout.write(
  JSON.stringify({
    baselineTimeouts,
    baselineWorkers,
    cycles,
    liveTimeouts: count('Timeout'),
    liveWorkers: count('WORKER'),
    taskAccounting,
  })
)
hook.disable()
