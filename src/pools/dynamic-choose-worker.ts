import type { Worker as ClusterWorker } from 'cluster'
import type { JSONValue } from '../utility-types'
import type { DynamicClusterPool } from './cluster/dynamic'
import type { DynamicThreadPool } from './thread/dynamic'
import type { ThreadWorkerWithMessageChannel } from './thread/fixed'

export function dynamicallyChooseWorker<
  DynamicPool extends DynamicThreadPool | DynamicClusterPool,
  Worker extends
    | ThreadWorkerWithMessageChannel
    | ClusterWorker = DynamicPool extends DynamicThreadPool
    ? ThreadWorkerWithMessageChannel
    : ClusterWorker,
  Data extends JSONValue = JSONValue
> (self: DynamicPool, superChooseWorker: () => Worker): Worker {
  for (const [worker, numberOfTasks] of self.tasks) {
    if (numberOfTasks === 0) {
      // A worker is free, use it
      // @ts-expect-error: Trust that tasks only contains correct worker
      return worker
    }
  }

  if (self.workers.length === self.max) {
    self.emitter.emit('FullPool')
    return superChooseWorker()
  }

  // All workers are busy, create a new worker
  // @ts-expect-error: Trust that function exists but its virtually protected
  const worker = self.createAndSetupWorker()
  // @ts-expect-error: Trust that function exists but its virtually protected
  self.registerWorkerMessageListener<Data>(worker, message => {
    if (message.kill) {
      // @ts-expect-error: Trust that function exists but its virtually protected
      self.sendToWorker(worker, { kill: 1 })
      // @ts-expect-error: Trust that function exists but its virtually protected
      void self.destroyWorker(worker)
    }
  })
  return worker
}
