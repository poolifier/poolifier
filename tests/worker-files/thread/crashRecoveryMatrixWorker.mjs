import { BroadcastChannel } from 'node:worker_threads'

import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

const channel = new BroadcastChannel(process.env.CRASH_RECOVERY_CHANNEL)
channel.unref()
const pendingOperations = new Map()
const pendingTasks = new Map()

channel.onmessage = ({ data }) => {
  if (data.target != null && data.target !== worker.id) return
  const operation = pendingOperations.get(data.operationId)
  if (operation != null) {
    pendingOperations.delete(data.operationId)
    if (data.action === 'ack') worker.completeOperation(operation)
    if (data.action === 'ack-crash') {
      worker.completeOperation(operation)
      setImmediate(() => {
        throw new Error('crash after ACK')
      })
    }
    if (data.action === 'nack') worker.rejectOperation(operation)
  }
  const task = pendingTasks.get(data.token)
  if (task != null && data.action === 'release') {
    pendingTasks.delete(data.token)
    task(data.token)
  }
  // eslint-disable-next-line n/no-process-exit
  if (data.action === 'crash-task') process.exit(2)
  if (data.action === 'crash-task-error') {
    setImmediate(() => {
      throw new Error(data.message)
    })
  }
}

const execute = data => {
  channel.postMessage({ event: 'dispatch', id: worker.id, ...data })
  switch (data.action) {
    case 'error-exit':
      queueMicrotask(() => {
        throw new Error('thread error then exit')
      })
      return new Promise(() => {})
    case 'reply-exit':
      // eslint-disable-next-line n/no-process-exit
      queueMicrotask(() => process.exit(0))
      return { replied: true }
    case 'wait':
      return new Promise(resolve => pendingTasks.set(data.token, resolve))
    case 'wait-crash':
      return new Promise(() => {})
    default:
      return data
  }
}

class CrashRecoveryMatrixWorker extends ThreadWorker {
  completeOperation (message) {
    super.handleTaskFunctionOperationMessage(message)
  }

  handleTaskFunctionOperationMessage (message) {
    if (!message.taskFunctionProperties.name.startsWith('matrix')) {
      super.handleTaskFunctionOperationMessage(message)
      return
    }
    pendingOperations.set(message.taskFunctionOperationId, message)
    channel.postMessage({
      event: 'operation',
      id: this.id,
      name: message.taskFunctionProperties.name,
      operation: message.taskFunctionOperation,
      operationId: message.taskFunctionOperationId,
    })
  }

  rejectOperation (message) {
    this.sendToMainWorker({
      taskFunctionOperation: message.taskFunctionOperation,
      taskFunctionOperationId: message.taskFunctionOperationId,
      taskFunctionOperationStatus: false,
      taskFunctionProperties: message.taskFunctionProperties,
    })
  }
}

const worker = new CrashRecoveryMatrixWorker(
  {
    execute,
    matrixTarget: execute,
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500,
  }
)
channel.postMessage({ event: 'online', id: worker.id })
