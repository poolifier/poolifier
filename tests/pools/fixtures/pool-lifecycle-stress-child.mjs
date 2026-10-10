import cluster from 'node:cluster'

import {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
  WorkerTerminationError,
} from '../../../lib/index.mjs'
import { createStressObserver } from './pool-lifecycle-stress-observer.mjs'

const usage =
  'Usage: pool-lifecycle-stress-child.mjs --transport thread|cluster --iterations N'
const options = new Map()
for (let index = 2; index < process.argv.length; index += 2) {
  options.set(process.argv[index], process.argv[index + 1])
}
const transport = options.get('--transport')
const iterationsText = options.get('--iterations')
const iterations = Number(iterationsText)
if (
  process.argv.length !== 6 ||
  options.size !== 2 ||
  !['cluster', 'thread'].includes(transport) ||
  !/^\d+$/.test(iterationsText ?? '') ||
  !Number.isSafeInteger(iterations) ||
  iterations < 1
) {
  throw new Error(usage)
}

const FixedPool = transport === 'thread' ? FixedThreadPool : FixedClusterPool
const DynamicPool =
  transport === 'thread' ? DynamicThreadPool : DynamicClusterPool
const extension = transport === 'thread' ? 'mjs' : 'cjs'
const workerPath = name =>
  `./tests/worker-files/${transport}/${name}Worker.${extension}`
const pools = []
const observer = createStressObserver(transport, PoolEvents)

/* eslint-disable perfectionist/sort-objects -- public schema order */
const report = {
  transport,
  iterations,
  failures: 0,
  duplicateLifecycleEvents: 0,
  replacementsAfterClose: 0,
  workersStillLive: 0,
  queued: 0,
  executing: 0,
  pendingTasks: 0,
  listenerDelta: 0,
  unexpectedErrors: 0,
}
/* eslint-enable perfectionist/sort-objects */

const workerId = worker =>
  transport === 'thread' ? worker.threadId : worker.id
const createPool = (Pool, size, path, extra = {}) => {
  const pool =
    Pool === DynamicPool
      ? new Pool(size, size + 1, path, observer.poolOptions(extra))
      : new Pool(size, path, observer.poolOptions(extra))
  observer.observePool(pool)
  pools.push(pool)
  return pool
}
const eventOnce = (emitter, event) =>
  new Promise(resolve => emitter.once(event, resolve))
const ready = async pool => {
  if (!pool.info.ready) await eventOnce(pool.emitter, PoolEvents.ready)
}
const outcome = observer.outcome
const failed = condition => {
  if (condition) ++report.failures
}
const isTermination = result =>
  result.status === 'rejected' &&
  (result.reason instanceof WorkerCrashError ||
    result.reason instanceof WorkerTerminationError)

const rejectTasksOnCrash = async () => {
  const pool = createPool(FixedPool, 1, workerPath('processExit'), {
    enableTasksQueue: true,
    restartWorkerOnError: false,
  })
  await ready(pool)
  const running = outcome(pool.execute())
  const queued = outcome(pool.execute())
  const [runningResult, queuedResult] = await Promise.all([running, queued])
  failed(!isTermination(runningResult) || !isTermination(queuedResult))
}

const useReplacementAfterCleanExit = async () => {
  const onlineIds = []
  const replacement = Promise.withResolvers()
  const worker = transport === 'thread' ? 'resolveThenExit' : 'cleanExit'
  const pool = createPool(FixedPool, 1, workerPath(worker), {
    enableTasksQueue: true,
    onlineHandler: function () {
      const id = workerId(this)
      if (onlineIds.length > 0 && id !== onlineIds[0]) replacement.resolve(id)
      onlineIds.push(id)
    },
  })
  await ready(pool)
  const replacementReady = eventOnce(pool.emitter, PoolEvents.ready)
  const first = outcome(pool.execute())
  const second = outcome(pool.execute())
  const [replacementId, , firstResult, secondResult] = await Promise.all([
    replacement.promise,
    replacementReady,
    first,
    second,
  ])
  failed(
    firstResult.status !== 'fulfilled' ||
      secondResult.status !== 'fulfilled' ||
      replacementId === onlineIds[0]
  )
}

const abortAtBoundaries = async () => {
  const pool = createPool(FixedPool, 1, workerPath('async'), {
    enableTasksQueue: true,
  })
  await ready(pool)
  const blocker = outcome(pool.execute({ boundary: 'blocker' }))
  const before = new AbortController()
  const beforeReason = new Error('abort before dispatch')
  before.abort(beforeReason)
  const beforeResult = outcome(pool.execute({}, undefined, before.signal))
  await blocker
  const during = new AbortController()
  const duringReason = new Error('abort during dispatch')
  const duringResult = outcome(pool.execute({}, undefined, during.signal))
  during.abort(duringReason)
  const after = new AbortController()
  const afterResult = await outcome(pool.execute({}, undefined, after.signal))
  after.abort(new Error('abort after settlement'))
  const [beforeOutcome, duringOutcome] = await Promise.all([
    beforeResult,
    duringResult,
  ])
  failed(
    beforeOutcome.reason !== beforeReason ||
      duringOutcome.reason !== duringReason
  )
  failed(afterResult.status !== 'fulfilled')
}

const destroyDuringRecovery = async () => {
  const pool = createPool(DynamicPool, 1, workerPath('processExit'), {
    enableTasksQueue: true,
  })
  await ready(pool)
  const error = eventOnce(pool.emitter, PoolEvents.error)
  const task = outcome(pool.execute())
  await error
  observer.beginClosing([pool])
  await Promise.all([pool.destroy(), pool.destroy()])
  observer.endClosing()
  failed(!isTermination(await task) || pool.info.started)
}

const preserveCallbackOrdering = async () => {
  const callbackSeen = Promise.withResolvers()
  const callbackOrder = []
  let taskTerminal = false
  const callback = () => {
    callbackOrder.push('callback')
    callbackSeen.resolve()
  }
  const worker = transport === 'thread' ? 'crash' : 'processExit'
  const pool = createPool(FixedPool, 1, workerPath(worker), {
    errorHandler: transport === 'thread' ? callback : () => undefined,
    exitHandler: transport === 'cluster' ? callback : undefined,
    restartWorkerOnError: false,
  })
  await ready(pool)
  const task = outcome(pool.execute()).then(result => {
    taskTerminal = true
    callbackOrder.push('task')
    return result
  })
  await callbackSeen.promise
  const result = await task
  failed(
    !taskTerminal ||
      !isTermination(result) ||
      callbackOrder.filter(entry => entry === 'callback').length !== 1
  )
}

const cleanupPools = async iterationPools => {
  observer.beginClosing(iterationPools)
  const outcomes = await Promise.allSettled(
    iterationPools.map(pool => (pool.info.started ? pool.destroy() : undefined))
  )
  const failures = outcomes.flatMap(result =>
    result.status === 'rejected' ? [result.reason] : []
  )
  observer.endClosing()
  if (failures.length > 0) {
    throw new AggregateError(failures, 'Pool lifecycle stress cleanup failed')
  }
}

const cleanupCluster = async () => {
  if (
    transport === 'cluster' &&
    cluster.isPrimary &&
    Object.keys(cluster.workers ?? {}).length > 0
  ) {
    await new Promise((resolve, reject) =>
      cluster.disconnect(error => {
        if (error != null) reject(error)
        else resolve()
      })
    )
  }
  await new Promise(resolve => setImmediate(resolve))
}

const failures = []
for (let iteration = 0; iteration < iterations; ++iteration) {
  const firstPool = pools.length
  try {
    await rejectTasksOnCrash()
    await useReplacementAfterCleanExit()
    await abortAtBoundaries()
    await destroyDuringRecovery()
    await preserveCallbackOrdering()
  } catch (error) {
    failures.push(error)
  }
  try {
    await cleanupPools(pools.slice(firstPool))
  } catch (error) {
    failures.push(error)
  }
}
try {
  await cleanupCluster()
} catch (error) {
  failures.push(error)
}
if (failures.length > 0) {
  throw new AggregateError(failures, 'Pool lifecycle stress execution failed')
}

Object.assign(report, observer.finish(pools))

const failedMetrics = Object.entries(report).some(
  ([key, value]) => key !== 'iterations' && key !== 'transport' && value !== 0
)
process.stdout.write(`${JSON.stringify(report)}\n`)
process.exitCode = failedMetrics ? 1 : 0
