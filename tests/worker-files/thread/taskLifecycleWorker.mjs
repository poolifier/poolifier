import { runInNewContext } from 'node:vm'
import { parentPort, workerData } from 'node:worker_threads'

import { ThreadWorker } from '../../../lib/index.mjs'

if (workerData?.startupGate != null) {
  parentPort.postMessage({ startupBlocked: true })
  Atomics.wait(new Int32Array(workerData.startupGate), 0, 0)
}

let promiseExecutions = 0
let proxyInvocations = 0
const replayGeneration =
  workerData?.replayGates == null
    ? undefined
    : Atomics.add(new Int32Array(workerData.replayCounter), 0, 1)
const replayGate =
  replayGeneration == null
    ? workerData?.replayGate
    : workerData.replayGates[replayGeneration]
const replayState = replayGate == null ? undefined : new Int32Array(replayGate)

class TaskLifecycleWorker extends ThreadWorker {
  sendToMainWorker = (() => {
    const send = this.sendToMainWorker
    return message => {
      if (message.kill != null && workerData?.failAckSend === message.kill) {
        throw new Error('Kill ACK transport failed')
      }
      send(message)
    }
  })()

  handleTaskFunctionOperationMessage (message) {
    if (replayState != null && Atomics.load(replayState, 0) === 0) {
      parentPort.postMessage({
        replayBlocked: true,
        replayGeneration,
        workerId: this.id,
      })
      Atomics.wait(replayState, 0, 0)
    }
    super.handleTaskFunctionOperationMessage(message)
  }
}

export default new TaskLifecycleWorker(
  {
    block: {
      taskFunction: ({ gate }) => {
        parentPort.postMessage({ blocked: true })
        Atomics.wait(new Int32Array(gate), 0, 0)
        return 'released'
      },
      workerNodeKeys: workerData?.blockWorkerKeys,
    },
    closedFailure: async ({ port }) => {
      port.close()
      throw new Error('Expected task failure')
    },
    echo: data => {
      parentPort.postMessage({ started: true })
      return data
    },
    failure: async () => {
      throw new Error('Expected task failure')
    },
    hold: async ({ gate }) => {
      parentPort.postMessage({ started: true })
      await Atomics.waitAsync(new Int32Array(gate), 0, 0).value
      return 'released'
    },
    mutatedFailure: data => {
      data.workerMutation = true
      throw new Error('Expected task failure')
    },
    promiseEcho: data =>
      Promise.resolve({ data, executions: ++promiseExecutions }),
    promiseFailure: () => Promise.reject(new Error('Promise task failure')),
    promiseHold: ({ gate }) => {
      parentPort.postMessage({ started: true })
      return Promise.resolve(
        Atomics.waitAsync(new Int32Array(gate), 0, 0).value
      ).then(() => 'released')
    },
    proxyFailure: new Proxy(async () => proxyInvocations, {
      apply (target, receiver, args) {
        if (++proxyInvocations === 1) throw new Error('Proxy task failure')
        return Reflect.apply(target, receiver, args)
      },
    }),
    syncFailure: () => {
      throw new Error('Expected task failure')
    },
  },
  {
    killHandler:
      workerData?.syncCleanup === true
        ? () => {
            if (workerData?.failCleanup === true) {
              throw new Error('Cleanup failure')
            }
          }
        : workerData?.foreignCleanup === true
          ? () =>
              runInNewContext(
                'new Promise((resolve, reject) => setImmediate(() => failCleanup ? reject(new Error("Cleanup failure")) : resolve()))',
                { failCleanup: workerData?.failCleanup === true, setImmediate }
              )
          : workerData?.decoratedCleanup === true
            ? () => {
                const promise = new Promise((resolve, reject) => {
                  setImmediate(() => {
                    if (workerData?.failCleanup === true) {
                      reject(new Error('Cleanup failure'))
                    } else {
                      resolve()
                    }
                  })
                })
                const originalThen = promise.then
                Object.defineProperty(promise, 'then', {
                  value (resolve, reject) {
                    originalThen.call(this, resolve, reject)
                  },
                })
                return promise
              }
            : async () => {
              await new Promise(resolve => setImmediate(resolve))
              if (workerData?.failCleanup === true) {
                throw new Error('Cleanup failure')
              }
            },
  }
)
