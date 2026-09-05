import { TaskFunctionTransactionManager } from '../../../lib/pools/task-function-transaction-manager.mjs'

export const taskFunction = label => ({
  taskFunction: Object.assign(data => ({ data, label }), { label }),
})

export const createTransactionFixture = ({
  automatic = true,
  compensationAutomatic = true,
  defer,
  onCommit,
  onPostCommitError,
  staticDefaultName = 'execute',
  staticNames = [],
  workers = 2,
} = {}) => {
  const handles = Array.from({ length: workers }, (_, index) => ({
    lease: { generation: 1, id: index + 1 },
    worker: {},
  }))
  const pending = []
  const sent = []
  const commits = []
  const deferredErrors = []
  const excluded = []
  const reconcileAdmissions = []
  const reconciled = []
  const quarantined = []
  const listeners = new Set()
  const sentWaiters = []
  let epoch = 0
  const fixture = {
    ack: workerId =>
      pending
        .findLast(item => !item.settled && item.workerId === workerId)
        ?.resolve(true),
    ackAll: () =>
      pending.filter(item => !item.settled).forEach(item => item.resolve(true)),
    automatic,
    changeTopology: () => {
      epoch++
      for (const listener of listeners) listener(epoch)
    },
    changeTopologyWithoutNotification: () => {
      epoch++
    },
    commits,
    crash: (workerId, error) =>
      pending
        .findLast(item => !item.settled && item.workerId === workerId)
        ?.reject(error),
    deferredErrors,
    excluded,
    handles,
    listenerCount: () => listeners.size,
    manager: undefined,
    nack: workerId =>
      pending
        .findLast(item => !item.settled && item.workerId === workerId)
        ?.resolve(false),
    quarantined,
    reconcileAdmissions,
    reconciled,
    sent,
    sentCount: count =>
      sent.length >= count
        ? Promise.resolve()
        : new Promise(resolve => {
          sentWaiters.push({ count, resolve })
        }),
  }
  fixture.manager = new TaskFunctionTransactionManager({
    defer: error => {
      deferredErrors.push(error)
      defer?.(error)
    },
    exclude: (handle, cause) => {
      excluded.push(handle)
      quarantined.push({ cause, handle })
      return true
    },
    hasStaticTaskFunction: name =>
      name === staticDefaultName || staticNames.includes(name),
    onCommit: (snapshot, previous) => {
      commits.push(snapshot)
      onCommit?.(snapshot, previous)
    },
    onPostCommitError,
    operationId: (() => {
      let value = 0
      return () => `operation-${++value}`
    })(),
    reconcile: handle => {
      reconciled.push(handle)
      reconcileAdmissions.push(
        fixture.manager.withStableCatalogAdmission(
          snapshot => snapshot.revision
        )
      )
    },
    send: (handle, request, signal) =>
      new Promise((resolve, reject) => {
        const item = {
          reject: error => {
            item.settled = true
            reject(error)
          },
          resolve: value => {
            item.settled = true
            resolve(value)
          },
          settled: false,
          workerId: handle.lease.id,
        }
        pending.push(item)
        sent.push({ ...request, workerId: handle.lease.id })
        for (const waiter of sentWaiters.splice(0)) {
          if (sent.length >= waiter.count) waiter.resolve()
          else sentWaiters.push(waiter)
        }
        const abort = () => item.reject(signal.reason)
        signal.addEventListener('abort', abort, { once: true })
        if (
          fixture.automatic ||
          (compensationAutomatic && request.operationId.endsWith(':compensate'))
        ) {
          item.resolve(true)
        }
      }),
    snapshotReadyHandles: () => handles,
    subscribeTopologyChanges: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    topologyEpoch: () => epoch,
  })
  fixture.initialization =
    staticDefaultName == null
      ? Promise.resolve()
      : fixture.manager.initializeStaticDefault(staticDefaultName)
  return fixture
}
