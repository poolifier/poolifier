import { ClusterWorker } from '../../../lib/index.mjs'

class LegacyTaskFunctionWorker extends ClusterWorker {
  handleTaskFunctionOperationMessage ({
    taskFunction,
    taskFunctionOperation,
    taskFunctionProperties,
    workerId,
  }) {
    queueMicrotask(() => {
      super.handleTaskFunctionOperationMessage({
        taskFunction,
        taskFunctionOperation,
        taskFunctionProperties,
        workerId,
      })
    })
  }
}

export default new LegacyTaskFunctionWorker(data => data)
