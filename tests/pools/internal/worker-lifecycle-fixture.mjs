import { WorkerLifecycleCoordinator } from '../../../lib/pools/worker-lifecycle-coordinator.mjs'

export const createFixture = ({ poolRunning = true, replace = true } = {}) => {
  const calls = []
  let releaseReplacement
  const replacementGate = new Promise(resolve => {
    releaseReplacement = resolve
  })
  const coordinator = new WorkerLifecycleCoordinator({
    complete: async () => calls.push(['complete']),
    drain: async () => calls.push(['drain']),
    exclude: lease => calls.push(['exclude', lease]),
    isPoolRunning: () => poolRunning,
    reconcile: async input => calls.push(['reconcile', input]),
    remove: lease => calls.push(['remove', lease]),
    replace: async input => {
      calls.push(['replace', input])
      if (replace === 'held') await replacementGate
    },
    shouldReplace: input =>
      replace !== false && input.handle.worker.info.dynamic === false,
    snapshotOwnedWork: () => [],
    terminate: async lease => calls.push(['terminate', lease]),
  })
  return { calls, coordinator, releaseReplacement }
}

export const worker = (id, dynamic = false, executing = 0) => ({
  info: { dynamic, id },
  usage: { tasks: { executing } },
})
export const register = (coordinator, workerNode) => {
  const handle = coordinator.register(workerNode)
  coordinator.finishProvisioning(handle)
  return handle
}
