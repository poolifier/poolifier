import {
  FixedThreadPool,
  PoolEvents,
  WorkerCrashError,
  WorkerTerminationError,
} from '../../../lib/index.mjs'

const scenario = process.argv[2]
const validScenarios = new Set([
  'combined-multiple-throw',
  'error-handler',
  'exit-handler',
  'no-listener',
  'non-throwing',
  'pool-error-listener',
])
if (!validScenarios.has(scenario)) {
  throw new Error(`Unknown worker handler throw scenario: ${scenario}`)
}

const thrownErrors = {
  errorHandler: new Error('task-4 error handler throw'),
  exitHandler: new Error('task-4 exit handler throw'),
  poolErrorListener: new Error('task-4 pool error listener throw'),
}
const callbackRecords = []
const order = []
const uncaught = []
const allExpectedThrows = Promise.withResolvers()
let taskOutcome

const snapshot = () => ({
  callbackRecords,
  destroying: pool.destroying,
  executingTasks: pool.info.executingTasks,
  order,
  originalWorkerRemoved: !pool.workerNodes.includes(originalWorkerNode),
  queuedTasks: pool.info.queuedTasks,
  started: pool.started,
  taskOutcome,
  workerNodes: pool.workerNodes.length,
})

const writeRecord = record => {
  process.stdout.write(`${JSON.stringify(record)}\n`)
}

if (scenario === 'combined-multiple-throw') {
  process.on('uncaughtException', error => {
    uncaught.push(error)
    order.push(`uncaught:${error.message}`)
    if (uncaught.length === 3) {
      allExpectedThrows.resolve()
    }
  })
} else if (scenario !== 'no-listener' && scenario !== 'non-throwing') {
  process.on('uncaughtExceptionMonitor', error => {
    order.push(`uncaught:${error.message}`)
    const expected =
      scenario === 'error-handler'
        ? thrownErrors.errorHandler
        : scenario === 'exit-handler'
          ? thrownErrors.exitHandler
          : thrownErrors.poolErrorListener
    writeRecord({
      ...snapshot(),
      exactIdentity: error === expected,
      marker: 'single-throw-monitor',
      message: error.message,
      uncaughtCount: 1,
    })
  })
}

const shouldThrow = scenario !== 'non-throwing'
const options = {
  enableTasksQueue: true,
  errorHandler: function (error) {
    callbackRecords.push({
      args: [error.message],
      sameThis: this === originalWorkerNode.worker,
      surface: 'errorHandler',
    })
    order.push('errorHandler')
    if (
      shouldThrow &&
      (scenario === 'error-handler' || scenario === 'combined-multiple-throw')
    ) {
      throw thrownErrors.errorHandler
    }
  },
  exitHandler: function (exitCode, signal) {
    callbackRecords.push({
      args: [exitCode, signal ?? null],
      sameThis: this === originalWorkerNode.worker,
      surface: 'exitHandler',
    })
    order.push('exitHandler')
    if (
      shouldThrow &&
      (scenario === 'exit-handler' || scenario === 'combined-multiple-throw')
    ) {
      throw thrownErrors.exitHandler
    }
  },
  restartWorkerOnError: false,
  tasksQueueOptions: { tasksFinishedTimeout: 0 },
}
const workerPath =
  scenario === 'exit-handler' || scenario === 'pool-error-listener'
    ? './tests/worker-files/thread/hangWorker.mjs'
    : './tests/worker-files/thread/crashWorker.mjs'
const pool = new FixedThreadPool(1, workerPath, options)
if (!pool.info.ready) {
  if (!pool.info.ready) {
    await new Promise(resolve => {
      pool.emitter.once(PoolEvents.ready, resolve)
    })
  }
}
const originalWorkerNode = pool.workerNodes[0]

if (scenario !== 'no-listener') {
  pool.emitter.on(PoolEvents.error, function (error) {
    callbackRecords.push({
      args: [error.name],
      sameThis: this === pool.emitter,
      surface: 'poolErrorListener',
    })
    order.push('poolErrorListener')
    if (
      shouldThrow &&
      (scenario === 'pool-error-listener' ||
        scenario === 'combined-multiple-throw')
    ) {
      throw thrownErrors.poolErrorListener
    }
  })
}

const busy = new Promise(resolve => pool.emitter.once(PoolEvents.busy, resolve))
const taskPromise = pool.execute().catch(error => {
  taskOutcome = {
    name: error.name,
    typed:
      error instanceof WorkerCrashError ||
      error instanceof WorkerTerminationError,
    workerId: error.workerId,
  }
  order.push(`taskRejected:${error.name}`)
  return error
})

await busy

if (scenario === 'exit-handler') {
  await pool.destroyWorkerNode(0)
} else if (scenario === 'pool-error-listener') {
  await pool.destroy()
}

await taskPromise

if (scenario === 'combined-multiple-throw') {
  await allExpectedThrows.promise
  if (pool.started) await pool.destroy()
  const expected = Object.values(thrownErrors)
  writeRecord({
    ...snapshot(),
    exactIdentities: expected.every(value => uncaught.includes(value)),
    marker: 'combined-final',
    messages: uncaught.map(value => value.message),
    uncaughtCount: uncaught.length,
    uniqueCount: new Set(uncaught).size,
  })
  process.removeAllListeners('uncaughtException')
  process.exitCode = 0
} else if (scenario === 'no-listener' || scenario === 'non-throwing') {
  if (pool.started) await pool.destroy()
  writeRecord({ ...snapshot(), marker: 'control-final', uncaughtCount: 0 })
}
