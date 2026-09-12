'use strict'

const dgram = require('node:dgram')

const { ClusterWorker } = require('../../../lib/index.cjs')

const host = process.env.CRASH_RECOVERY_HOST
const port = Number(process.env.CRASH_RECOVERY_PORT)
const socket = dgram.createSocket('udp4')
const pendingOperations = new Map()

const post = message => {
  socket.send(JSON.stringify({ id: worker.id, ...message }), port, host)
}

socket.on('message', buffer => {
  const data = JSON.parse(buffer.toString())
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
  if (data.action === 'crash-task') {
    // eslint-disable-next-line n/no-process-exit
    process.exit(2)
  }
})

const execute = data => {
  post({ event: 'dispatch', ...data })
  switch (data.action) {
    case 'error-exit':
      setImmediate(() => {
        throw new Error('cluster error then exit')
      })
      return new Promise(() => {})
    case 'reply-exit':
      setImmediate(() => {
        // eslint-disable-next-line n/no-process-exit
        process.exit(0)
      })
      return { replied: true }
    case 'wait-crash':
      return new Promise(() => {})
    default:
      return data
  }
}

class CrashRecoveryMatrixWorker extends ClusterWorker {
  completeOperation (message) {
    super.handleTaskFunctionOperationMessage(message)
  }

  handleTaskFunctionOperationMessage (message) {
    if (!message.taskFunctionProperties.name.startsWith('matrix')) {
      super.handleTaskFunctionOperationMessage(message)
      return
    }
    pendingOperations.set(message.taskFunctionOperationId, message)
    post({
      event: 'operation',
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

const worker = new CrashRecoveryMatrixWorker({
  execute,
  matrixTarget: execute,
})
post({ event: 'online', run: process.env.CRASH_RECOVERY_RUN })
