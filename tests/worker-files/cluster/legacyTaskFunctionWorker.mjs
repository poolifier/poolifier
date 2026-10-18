import { ClusterWorker } from '../../../lib/index.mjs'

class LegacyTaskFunctionWorker extends ClusterWorker {
  sendToMainWorker = (() => {
    const send = this.sendToMainWorker
    let statusOnlySent = false
    return message => {
      const response = { ...message }
      delete response.taskFunctionOperationId
      if (
        !statusOnlySent &&
        response.taskFunctionOperationStatus != null &&
        response.taskFunctionOperation ===
          process.env.POOLIFIER_TEST_STATUS_ONLY_OPERATION
      ) {
        statusOnlySent = true
        delete response.taskFunctionProperties
      }
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
