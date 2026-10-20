import { isMainThread, parentPort } from 'node:worker_threads'

import { ClusterWorker, ThreadWorker } from '../../lib/index.mjs'

const Worker = isMainThread ? ClusterWorker : ThreadWorker
const notify = message => {
  if (parentPort != null) parentPort.postMessage(message)
  else process.send(message)
}

class TaskFunctionRecoveryWorker extends Worker {
  constructor (...args) {
    super(...args)
    const controlPort = parentPort ?? process
    controlPort.on('message', message => {
      if (message.control === 'hold') {
        this.heldOperation = {
          name: message.name,
          operation: message.operation,
        }
      } else if (message.control === 'release') {
        const pending = this.pendingOperation
        this.pendingOperation = undefined
        if (pending != null) super.handleTaskFunctionOperationMessage(pending)
      } else {
        return
      }
      notify({ control: message.control, workerId: this.id })
    })
  }

  handleTaskFunctionOperationMessage (message) {
    if (
      this.heldOperation?.operation === message.taskFunctionOperation &&
      this.heldOperation.name === message.taskFunctionProperties?.name
    ) {
      this.heldOperation = undefined
      this.pendingOperation = message
      notify({
        heldOperation: message.taskFunctionOperation,
        workerId: this.id,
      })
      return
    }
    super.handleTaskFunctionOperationMessage(message)
  }
}

export default new TaskFunctionRecoveryWorker({ echo: data => data })
