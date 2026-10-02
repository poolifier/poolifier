import cluster from 'node:cluster'
import { EventEmitter } from 'node:events'
import { expect, it } from 'vitest'

import { createStressObserver } from './pool-lifecycle-stress-observer.mjs'

const PoolEvents = {
  error: 'error',
  ready: 'ready',
  taskError: 'taskError',
}

const createWorker = id => ({
  id,
  isConnected: () => false,
  isDead: () => true,
  process: { exitCode: 0, signalCode: null },
})

const createLiveWorker = id => ({
  ...createWorker(id),
  isConnected: () => true,
  isDead: () => false,
  process: { exitCode: null, signalCode: null },
})

it('deduplicates workers admitted after the close snapshot', () => {
  const existingWorker = createWorker(1)
  const replacementWorker = createWorker(2)
  const pool = {
    emitter: new EventEmitter(),
    info: { executingTasks: 0, queuedTasks: 0 },
    workerNodes: [{ worker: existingWorker }],
  }
  const observer = createStressObserver('cluster', PoolEvents)
  const options = observer.poolOptions({})
  observer.observePool(pool)

  observer.beginClosing([pool])
  options.onlineHandler.call(existingWorker)
  pool.emitter.emit(PoolEvents.ready)
  options.onlineHandler.call(replacementWorker)
  options.onlineHandler.call(replacementWorker)
  observer.endClosing()

  expect(observer.finish([pool]).replacementsAfterClose).toBe(1)
})

it('counts the same live cluster worker once across lifecycle sources', () => {
  const worker = createLiveWorker(1)
  const originalWorkers = cluster.workers
  const observer = createStressObserver('cluster', PoolEvents)
  const options = observer.poolOptions({})

  try {
    cluster.workers = { [worker.id]: worker }
    options.onlineHandler.call(worker)

    expect(observer.finish([]).workersStillLive).toBe(1)
  } finally {
    cluster.workers = originalWorkers
  }
})

it('counts distinct live cluster workers separately', () => {
  const firstWorker = createLiveWorker(1)
  const secondWorker = createLiveWorker(2)
  const originalWorkers = cluster.workers
  const observer = createStressObserver('cluster', PoolEvents)
  const options = observer.poolOptions({})

  try {
    cluster.workers = {
      [firstWorker.id]: firstWorker,
      [secondWorker.id]: secondWorker,
    }
    options.onlineHandler.call(firstWorker)
    options.onlineHandler.call(secondWorker)

    expect(observer.finish([]).workersStillLive).toBe(2)
  } finally {
    cluster.workers = originalWorkers
  }
})
