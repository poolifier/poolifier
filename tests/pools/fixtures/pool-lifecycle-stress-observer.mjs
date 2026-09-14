import cluster from 'node:cluster'
import { getEventListeners } from 'node:events'

const observedProcessEvents = ['uncaughtException', 'unhandledRejection']

export const createStressObserver = (transport, PoolEvents) => {
  const baselineListeners = new Map(
    observedProcessEvents.map(event => [
      event,
      getEventListeners(process, event).length,
    ])
  )
  const expectedErrors = new Set()
  const pendingTasks = new Set()
  const terminalEvents = new Set()
  const workers = new Map()
  let closeSnapshot = new Set()
  let workersAdmittedAfterClose = new Set()
  let closing = false
  let duplicateLifecycleEvents = 0
  let replacementsAfterClose = 0
  let unexpectedErrors = 0

  const workerId = worker =>
    transport === 'thread' ? worker.threadId : worker.id
  const recordTerminalEvent = key => {
    if (terminalEvents.has(key)) ++duplicateLifecycleEvents
    terminalEvents.add(key)
  }
  const errorKey = (event, error) =>
    [
      event,
      error.name,
      error.workerId ?? 'pool',
      error.taskId ?? 'none',
      error.taskFunctionName ?? 'none',
      error.message,
    ].join(':')
  const poolOptions = extra => {
    const {
      errorHandler = () => undefined,
      exitHandler = () => undefined,
      onlineHandler = () => undefined,
      ...rest
    } = extra
    return {
      ...(transport === 'cluster' ? { settings: { silent: true } } : {}),
      ...rest,
      errorHandler,
      exitHandler: function (...args) {
        const observation = workers.get(this)
        if (observation != null) observation.exited = true
        recordTerminalEvent(`exit:${observation?.id ?? workerId(this)}`)
        return exitHandler.apply(this, args)
      },
      onlineHandler: function (...args) {
        const id = workerId(this)
        workers.set(this, { exited: false, id, worker: this })
        const snapshotMember = closeSnapshot.has(this)
        const admittedAfterClose =
          closing && !snapshotMember && !workersAdmittedAfterClose.has(this)
        if (admittedAfterClose) {
          workersAdmittedAfterClose.add(this)
          ++replacementsAfterClose
        }
        return onlineHandler.apply(this, args)
      },
    }
  }
  const observePool = pool => {
    pool.emitter.on(PoolEvents.error, error =>
      recordTerminalEvent(errorKey('error', error))
    )
    pool.emitter.on(PoolEvents.taskError, error =>
      recordTerminalEvent(errorKey('taskError', error))
    )
  }
  const outcome = promise => {
    const token = {}
    pendingTasks.add(token)
    return promise
      .then(
        value => ({ status: 'fulfilled', value }),
        reason => ({ reason, status: 'rejected' })
      )
      .finally(() => pendingTasks.delete(token))
  }
  const onUnexpectedError = error => {
    if (expectedErrors.delete(error)) return
    ++unexpectedErrors
    process.stderr.write(`${error?.stack ?? error}\n`)
    process.exitCode = 1
  }
  for (const event of observedProcessEvents) {
    process.on(event, onUnexpectedError)
  }

  return {
    beginClosing: pools => {
      closing = true
      workersAdmittedAfterClose = new Set()
      closeSnapshot = new Set(
        pools.flatMap(pool =>
          pool.workerNodes.map(workerNode => workerNode.worker)
        )
      )
    },
    endClosing: () => {
      closing = false
      closeSnapshot = new Set()
      workersAdmittedAfterClose = new Set()
    },
    expectUncaught: error => expectedErrors.add(error),
    finish: pools => {
      for (const event of observedProcessEvents) {
        process.removeListener(event, onUnexpectedError)
      }
      const workerObservations =
        transport === 'cluster' && cluster.isPrimary
          ? [
              ...new Set([
                ...workers.keys(),
                ...Object.values(cluster.workers ?? {}),
              ]),
            ].map(worker => ({
              exited: workers.get(worker)?.exited ?? false,
              worker,
            }))
          : workers.values()
      const workersStillLive = [...workerObservations].filter(
        ({ exited, worker }) => {
          if (exited) return false
          if (transport === 'thread') return worker.threadId !== -1
          return (
            !worker.isDead() ||
            worker.isConnected() ||
            (worker.process.exitCode == null &&
              worker.process.signalCode == null)
          )
        }
      ).length
      return {
        duplicateLifecycleEvents,
        executing: pools.reduce(
          (total, pool) => total + pool.info.executingTasks,
          0
        ),
        listenerDelta: [...baselineListeners].reduce(
          (total, [event, count]) =>
            total + Math.abs(getEventListeners(process, event).length - count),
          0
        ),
        pendingTasks: pendingTasks.size,
        queued: pools.reduce(
          (total, pool) => total + (pool.info.queuedTasks ?? 0),
          0
        ),
        replacementsAfterClose,
        unexpectedErrors,
        workersStillLive,
      }
    },
    observePool,
    outcome,
    poolOptions,
  }
}
