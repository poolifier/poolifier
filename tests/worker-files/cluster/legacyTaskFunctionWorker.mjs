import { ClusterWorker } from '../../../lib/index.mjs'

class LegacyTaskFunctionWorker extends ClusterWorker {
  sendToMainWorker = (() => {
    const send = this.sendToMainWorker
    return message => {
      const response = { ...message }
      delete response.taskFunctionOperationId
      send(response)
    }
  })()

  constructor (...args) {
    super(...args)
    this.operationMessages = []
    this.operationAvailable = Promise.withResolvers()
    this.consumeTaskFunctionOperations().catch(error => {
      queueMicrotask(() => {
        throw error
      })
    })
  }

  async consumeTaskFunctionOperations () {
    for (;;) {
      await this.operationAvailable.promise
      this.operationAvailable = Promise.withResolvers()
      while (this.operationMessages.length > 0) {
        super.handleTaskFunctionOperationMessage(this.operationMessages.shift())
      }
    }
  }

  handleTaskFunctionOperationMessage ({
    taskFunction,
    taskFunctionOperation,
    taskFunctionProperties,
    workerId,
  }) {
    this.operationMessages.push({
      taskFunction,
      taskFunctionOperation,
      taskFunctionProperties,
      workerId,
    })
    this.operationAvailable.resolve()
  }
}

export default new LegacyTaskFunctionWorker(data => data)
