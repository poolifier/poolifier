import { runInNewContext } from 'node:vm'
import { parentPort, workerData } from 'node:worker_threads'

import { KillBehaviors, ThreadWorker } from '../../../lib/index.mjs'

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
    let duplicateScheduled = false
    return message => {
      if (message.kill != null && workerData?.failAckSend === message.kill) {
        throw new Error('Kill ACK transport failed')
      }
      send(message)
      if (
        message.taskFunctionOperationStatus != null &&
        workerData?.duplicateAckGate != null &&
        !duplicateScheduled
      ) {
        duplicateScheduled = true
        Promise.resolve(
          Atomics.waitAsync(new Int32Array(workerData.duplicateAckGate), 0, 0)
            .value
        )
          .then(() => {
            send(message)
            parentPort.postMessage({ duplicateSent: true })
            return undefined
          })
          .catch(error => {
            queueMicrotask(() => {
              throw error
            })
          })
      }
    }
  })()

  handleTaskFunctionOperationMessage (message) {
    if (workerData?.legacyTaskFunctionMessages === true) {
      const {
        taskFunction,
        taskFunctionOperation,
        taskFunctionProperties,
        workerId,
      } = message
      message = {
        taskFunction,
        taskFunctionOperation,
        taskFunctionProperties,
        workerId,
      }
    }
    if (replayState != null && Atomics.load(replayState, 0) === 0) {
      parentPort.postMessage({
        replayBlocked: true,
        replayGeneration,
        workerId: this.id,
      })
      if (workerData?.asyncReplay === true) {
        Promise.resolve(Atomics.waitAsync(replayState, 0, 0).value)
          .then(() => {
            super.handleTaskFunctionOperationMessage(message)
            return undefined
          })
          .catch(error => {
            queueMicrotask(() => {
              throw error
            })
          })
        return
      }
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
    proxyPromise: new Proxy(
      async data => {
        if (data.fail) throw new Error('Decorated task failure')
        return 42
      },
      {
        apply (target, receiver, args) {
          const promise = Reflect.apply(target, receiver, args)
          const originalThen = promise.then
          let reads = 0
          Object.defineProperty(promise, 'then', {
            get () {
              if (++reads > 1) throw new Error('Repeated then access')
              return function (resolve, reject) {
                Reflect.apply(originalThen, this, [resolve, reject])
              }
            },
          })
          return promise
        },
      }
    ),
    syncFailure: () => {
      throw new Error('Expected task failure')
    },
  },
  {
    ...(workerData?.hardReplayKill === true && {
      killBehavior: KillBehaviors.HARD,
      maxInactiveTime: 50,
    }),
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
                const then = function (resolve, reject) {
                  Reflect.apply(originalThen, this, [resolve, reject])
                }
                Object.setPrototypeOf(then, null)
                Object.defineProperty(promise, 'then', { value: then })
                return promise
              }
            : async () => {
              if (workerData?.cleanupGate != null) {
                parentPort.postMessage({ cleanupStarted: true })
                await Atomics.waitAsync(
                  new Int32Array(workerData.cleanupGate),
                  0,
                  0
                ).value
              } else {
                await new Promise(resolve => setImmediate(resolve))
              }
              if (workerData?.failCleanup === true) {
                throw new Error('Cleanup failure')
              }
            },
  }
)
