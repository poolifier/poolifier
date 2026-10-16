// Required to exercise synchronous destruction from task async resource callbacks.
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { createHook } from 'node:async_hooks'
import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { promisify } from 'node:util'
import { MessageChannel } from 'node:worker_threads'
import { describe, expect, it } from 'vitest'

import {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  WorkerChoiceStrategies,
} from '../../lib/index.mjs'

const bounded = async promise => {
  let timeout
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Task remained pending')),
          5000
        )
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}

const send = (workerNode, message) => {
  const workerMessage = { ...message, workerId: workerNode.info.id }
  if (workerNode.worker.postMessage != null) {
    workerNode.worker.postMessage(workerMessage)
  } else {
    workerNode.worker.send(workerMessage)
  }
}

const started = (workerNode, id) => {
  return new Promise(resolve => {
    const listener = message => {
      if (message.started === id) {
        workerNode.worker.off('message', listener)
        resolve()
      }
    }
    workerNode.worker.on('message', listener)
  })
}

const cleanupRegressionPool = async (pool, capturedNodes) => {
  pool.opts.restartWorkerOnError = false
  // Do not flush held tasks or rely on WorkerNode.terminate during failure cleanup.
  await Promise.all(
    [...new Set([...capturedNodes, ...pool.workerNodes])].map(async node => {
      if (node.worker.process != null) {
        if (!node.worker.isDead()) {
          const exit = new Promise(resolve => node.worker.once('exit', resolve))
          node.worker.process.kill()
          await bounded(exit)
        }
      } else {
        await bounded(node.worker.terminate())
      }
    })
  )
  await bounded(pool.destroy())
}

for (const [workerType, PoolClass, workerFile] of [
  ['thread', FixedThreadPool, './tests/worker-files/thread/crashWorker.mjs'],
  ['cluster', FixedClusterPool, './tests/worker-files/cluster/crashWorker.cjs'],
]) {
  describe(`${workerType} worker exit`, { retry: 0 }, () => {
    const createPool = async (size = 1, options = {}) => {
      const pool = new PoolClass(size, workerFile, {
        workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
        ...options,
      })
      pool.emitter.on('error', () => {})
      if (!pool.info.ready) await bounded(once(pool.emitter, 'ready'))
      return pool
    }

    for (const restartWorkerOnError of [true, false]) {
      it(`rejects a crashed worker's running and stranded queued tasks (restart: ${restartWorkerOnError})`, async () => {
        const pool = await createPool(1, {
          enableTasksQueue: true,
          restartWorkerOnError,
        })
        try {
          const workerNode = pool.workerNodes[0]
          const running = started(workerNode, 'running')
          const results = [
            pool.execute({ id: 'running', wait: true }).catch(error => error),
            pool.execute({ id: 'queued' }).catch(error => error),
          ]
          await bounded(running)
          const exit = new Promise(resolve =>
            workerNode.worker.once('exit', resolve)
          )
          send(workerNode, { crash: true })
          const outcomes = await bounded(Promise.all(results))
          expect(outcomes[0]).toBeInstanceOf(Error)
          expect(outcomes[1]).toBeInstanceOf(Error)
          await bounded(exit)
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          await pool.destroy()
        }
      })
    }

    for (const exitCode of [0, 1]) {
      it(`rejects a task when its worker exits with code ${exitCode} without an error event`, async () => {
        const pool = await createPool()
        try {
          const result = await bounded(
            pool.execute({ exitCode }).catch(error => error)
          )
          expect(result).toBeInstanceOf(Error)
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          await pool.destroy()
        }
      })
    }

    it('can destroy the pool from the configured exit handler', async () => {
      let destruction
      const pool = await createPool(1, {
        exitHandler () {
          destruction ??= pool.destroy()
        },
      })
      try {
        expect(
          await bounded(pool.execute({ exitCode: 1 }).catch(error => error))
        ).toBeInstanceOf(Error)
        await bounded(destruction)
        expect(pool.promiseResponseMap.size).toBe(0)
        expect(pool.info.started).toBe(false)
      } finally {
        if (pool.info.started) await bounded(pool.destroy())
      }
    })

    it('can destroy the pool from a task async resource before callback', async () => {
      const pool = await createPool()
      const taskResources = new Set()
      let destruction
      const hook = createHook({
        before (asyncId) {
          if (taskResources.has(asyncId) && destruction == null) {
            destruction = pool.destroy()
          }
        },
        init (asyncId, type) {
          if (type === 'poolifier:task') taskResources.add(asyncId)
        },
      })
      hook.enable()
      try {
        expect(
          await bounded(pool.execute({ exitCode: 1 }).catch(error => error))
        ).toBeInstanceOf(Error)
        await bounded(destruction)
        expect(pool.promiseResponseMap.size).toBe(0)
        expect(pool.info.started).toBe(false)
      } finally {
        hook.disable()
        if (pool.info.started) await bounded(pool.destroy())
      }
    })

    it('can destroy the pool from backPressureEnd during exit redistribution', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          size: 1,
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      let destruction
      try {
        await pool.execute({ warmup: true })
        const [source, destination] = pool.workerNodes
        const sourceStarted = started(source, 'source')
        const destinationStarted = started(destination, 'destination')
        const failed = pool
          .execute({ id: 'source', wait: true })
          .catch(error => error)
        pool.execute({ id: 'destination', wait: true }).catch(() => {})
        const backPressure = once(pool.emitter, 'backPressure')
        pool.execute({ id: 'source-queued' }).catch(() => {})
        pool.execute({ id: 'destination-queued' }).catch(() => {})
        await bounded(
          Promise.all([sourceStarted, destinationStarted, backPressure])
        )
        pool.emitter.once('backPressureEnd', () => {
          destruction = pool.destroy()
        })
        send(source, { exitCode: 1 })
        expect(await bounded(failed)).toBeInstanceOf(Error)
        await bounded(destruction)
        expect(pool.info.started).toBe(false)
      } finally {
        if (pool.info.started) await bounded(pool.destroy())
      }
    })

    it('keeps healthy tasks and redistributed queued tasks after an earlier worker exits', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        await pool.execute({ warmup: true })
        const [failedNode, healthyNode] = pool.workerNodes
        const failedStarted = started(failedNode, 'failed')
        const healthyStarted = started(healthyNode, 'healthy')
        const failed = pool
          .execute({ id: 'failed', wait: true })
          .catch(error => error)
        const healthyData = { id: 'healthy', wait: true }
        const healthy = pool.execute(healthyData)
        const queuedData = { id: 'redistributed' }
        const queued = pool.execute(queuedData)
        await bounded(Promise.all([failedStarted, healthyStarted]))
        const exit = new Promise(resolve =>
          failedNode.worker.once('exit', resolve)
        )
        send(failedNode, { crash: true })
        expect(await bounded(failed)).toBeInstanceOf(Error)
        await bounded(exit)
        send(healthyNode, { release: 'healthy' })
        expect(await bounded(healthy)).toStrictEqual(healthyData)
        expect(await bounded(queued)).toStrictEqual(queuedData)
        expect(healthyNode.usage.tasks.executing).toBe(0)
      } finally {
        await pool.destroy()
      }
    })

    for (const [failure, message] of [
      ['crash', { crash: true }],
      ['silent exit', { exitCode: 1 }],
    ]) {
      it(`preserves sparse affinity against live worker indices after a ${failure}`, async () => {
        const executions = []
        const completions = []
        class AffinityPool extends PoolClass {
          afterTaskExecutionHook (workerNodeKey, response) {
            if (response.data?.id === 'affinity') {
              completions.push({
                workerId: this.workerNodes[workerNodeKey].info.id,
                workerNodeKey,
              })
            }
            super.afterTaskExecutionHook(workerNodeKey, response)
          }

          beforeTaskExecutionHook (workerNodeKey, task) {
            if (task.data?.id === 'affinity') {
              executions.push({
                workerId: this.workerNodes[workerNodeKey].info.id,
                workerNodeKey,
              })
            }
            super.beforeTaskExecutionHook(workerNodeKey, task)
          }
        }
        const pool = new AffinityPool(3, workerFile, {
          enableTasksQueue: true,
          tasksQueueOptions: {
            concurrency: 1,
            tasksStealingOnBackPressure: false,
            taskStealing: false,
          },
          workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
        })
        pool.emitter.on('error', () => {})
        try {
          if (!pool.info.ready) await bounded(once(pool.emitter, 'ready'))
          await bounded(
            pool.addTaskFunction('affinityEcho', {
              taskFunction: data => data,
              workerNodeKeys: [0, 2],
            })
          )
          const [source, firstHealthy, secondHealthy] = pool.workerNodes
          const healthyData = [
            { id: 'first-healthy', wait: true },
            { id: 'second-healthy', wait: true },
          ]
          const running = [
            started(firstHealthy, 'first-healthy'),
            started(secondHealthy, 'second-healthy'),
            started(source, 'source'),
          ]
          const healthy = healthyData.map(data => pool.execute(data))
          const failed = pool
            .execute({ id: 'source', wait: true })
            .catch(error => error)
          await bounded(Promise.all(running))
          const queuedData = [{ id: 'first-queued' }, { id: 'second-queued' }]
          const queued = queuedData.map(data => pool.execute(data))
          const affinityData = { id: 'affinity' }
          const affinity = pool
            .execute(affinityData, 'affinityEcho')
            .catch(error => error)
          expect(source.tasksQueue.size).toBe(1)
          const exit = new Promise(resolve =>
            source.worker.once('exit', resolve)
          )
          send(source, message)
          await bounded(exit)
          expect(await bounded(failed)).toBeInstanceOf(Error)
          send(firstHealthy, { release: 'first-healthy' })
          send(secondHealthy, { release: 'second-healthy' })
          expect(await bounded(Promise.all(healthy))).toStrictEqual(healthyData)
          expect(await bounded(Promise.all(queued))).toStrictEqual(queuedData)
          expect(await bounded(affinity)).toStrictEqual(affinityData)
          expect(executions).toHaveLength(1)
          expect([0, 2]).toContain(executions[0].workerNodeKey)
          expect(executions[0].workerId).toBe(
            pool.workerNodes[executions[0].workerNodeKey].info.id
          )
          expect(completions).toStrictEqual(executions)
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          await pool.destroy()
        }
      })
    }

    it('rejects a queued default task pinned to the exited worker', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        await bounded(
          pool.addTaskFunction('pinnedEcho', {
            taskFunction: data => data,
            workerNodeKeys: [1],
          })
        )
        const source = pool.workerNodes[1]
        const running = started(source, 'running')
        const runningResult = pool
          .execute({ id: 'running', wait: true })
          .catch(error => error)
        await bounded(running)
        await bounded(pool.setDefaultTaskFunction('pinnedEcho'))
        const queuedResult = pool
          .execute({ id: 'queued' })
          .catch(error => error)
        expect(source.tasksQueue.size).toBe(1)
        const exit = new Promise(resolve => source.worker.once('exit', resolve))
        send(source, { exitCode: 0 })
        const outcomes = await bounded(
          Promise.all([runningResult, queuedResult])
        )
        expect(outcomes[0]).toBeInstanceOf(Error)
        expect(outcomes[1]).toBeInstanceOf(Error)
        await bounded(exit)
      } finally {
        await pool.destroy()
      }
    })

    it('redistributes a later eligible task after a stranded pinned task', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        await bounded(
          pool.addTaskFunction('pinnedEcho', {
            taskFunction: data => data,
            workerNodeKeys: [1],
          })
        )
        const source = pool.workerNodes[1]
        const running = started(source, 'running')
        const runningResult = pool
          .execute({ id: 'running', wait: true })
          .catch(error => error)
        await bounded(running)
        const pinnedResult = pool
          .execute({ id: 'pinned' }, 'pinnedEcho')
          .catch(error => error)
        const quickData = { id: 'quick' }
        expect(await bounded(pool.execute(quickData))).toStrictEqual(quickData)
        const eligibleData = { id: 'eligible' }
        const eligibleResult = pool.execute(eligibleData)
        expect(source.tasksQueue.size).toBe(2)
        const exit = new Promise(resolve => source.worker.once('exit', resolve))
        send(source, { exitCode: 0 })
        const outcomes = await bounded(
          Promise.all([runningResult, pinnedResult, eligibleResult])
        )
        expect(outcomes[0]).toBeInstanceOf(Error)
        expect(outcomes[1]).toBeInstanceOf(Error)
        expect(outcomes[2]).toStrictEqual(eligibleData)
        await bounded(exit)
      } finally {
        await pool.destroy()
      }
    })

    it('rejects a stolen task only when its actual execution worker crashes', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        await pool.execute({ warmup: true })
        const [source, destination] = pool.workerNodes
        const sourceStarted = started(source, 'source')
        const destinationStarted = started(destination, 'destination')
        const sourceResult = pool
          .execute({ id: 'source', wait: true })
          .catch(error => error)
        const destinationData = { id: 'destination', wait: true }
        const destinationResult = pool.execute(destinationData)
        const stolenStarted = started(destination, 'stolen')
        const stolenResult = pool
          .execute({ id: 'stolen', wait: true })
          .catch(error => error)
        await bounded(Promise.all([sourceStarted, destinationStarted]))
        pool.stealTask(source, 1)
        send(destination, { release: 'destination' })
        expect(await bounded(destinationResult)).toStrictEqual(destinationData)
        await bounded(stolenStarted)
        const sourceExit = new Promise(resolve =>
          source.worker.once('exit', resolve)
        )
        send(source, { crash: true })
        expect(await bounded(sourceResult)).toBeInstanceOf(Error)
        await bounded(sourceExit)
        const destinationExit = new Promise(resolve =>
          destination.worker.once('exit', resolve)
        )
        send(destination, { crash: true })
        expect(await bounded(stolenResult)).toBeInstanceOf(Error)
        await bounded(destinationExit)
      } finally {
        await pool.destroy()
      }
    })

    it('can abort all redistributing tasks from backPressureEnd', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          size: 2,
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        await pool.execute({ warmup: true })
        const [source, destination] = pool.workerNodes
        const sourceStarted = started(source, 'source')
        const destinationStarted = started(destination, 'destination')
        const sourceResult = pool
          .execute({ id: 'source', wait: true })
          .catch(error => error)
        const destinationData = { id: 'destination', wait: true }
        const destinationResult = pool.execute(destinationData)
        const controller = new AbortController()
        const backPressure = once(pool.emitter, 'backPressure')
        const firstController = new AbortController()
        let firstAbortedError
        const firstAbortedResult = pool
          .execute({ id: 'first-aborted' }, undefined, firstController.signal)
          .catch(error => {
            firstAbortedError = error
            return error
          })
        const firstHealthyData = { id: 'first-healthy' }
        const firstHealthyResult = pool.execute(firstHealthyData)
        let abortedError
        const abortedResult = pool
          .execute({ id: 'aborted' }, undefined, controller.signal)
          .catch(error => {
            abortedError = error
            return error
          })
        const healthyData = { id: 'healthy' }
        const healthyResult = pool.execute(healthyData)
        await bounded(
          Promise.all([sourceStarted, destinationStarted, backPressure])
        )
        expect(source.tasksQueue.size).toBe(2)
        expect(destination.tasksQueue.size).toBe(2)
        pool.emitter.once('backPressureEnd', () => {
          firstController.abort()
          controller.abort()
        })
        const exit = new Promise(resolve => source.worker.once('exit', resolve))
        send(source, { crash: true })
        expect(await bounded(sourceResult)).toBeInstanceOf(Error)
        expect(controller.signal.aborted).toBe(true)
        expect(firstController.signal.aborted).toBe(true)
        expect(firstAbortedError).toBeInstanceOf(Error)
        expect(abortedError).toBeInstanceOf(Error)
        send(destination, { release: 'destination' })
        expect(await bounded(abortedResult)).toBeInstanceOf(Error)
        expect(await bounded(firstAbortedResult)).toBeInstanceOf(Error)
        expect(await bounded(firstHealthyResult)).toStrictEqual(
          firstHealthyData
        )
        expect(await bounded(destinationResult)).toStrictEqual(destinationData)
        expect(await bounded(healthyResult)).toStrictEqual(healthyData)
        await bounded(exit)
        expect(pool.promiseResponseMap.size).toBe(0)
      } finally {
        await pool.destroy()
      }
    })

    it('skips a detached queued task aborted by an earlier migration hook', async () => {
      const controller = new AbortController()
      const executions = []
      class AbortingPool extends PoolClass {
        beforeTaskExecutionHook (workerNodeKey, task) {
          executions.push(task.data?.id)
          if (task.data?.id === 'first-migrated') controller.abort()
          super.beforeTaskExecutionHook(workerNodeKey, task)
        }
      }
      const pool = new AbortingPool(2, workerFile, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
        workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      })
      pool.emitter.on('error', () => {})
      try {
        if (!pool.info.ready) await bounded(once(pool.emitter, 'ready'))
        await bounded(pool.execute({ warmup: true }))
        const [source, destination] = pool.workerNodes
        const sourceStarted = started(source, 'source')
        const destinationStarted = started(destination, 'destination')
        const failed = pool
          .execute({ id: 'source', wait: true })
          .catch(error => error)
        const healthyData = { id: 'destination', wait: true }
        const healthy = pool.execute(healthyData)
        const firstData = { id: 'first-migrated' }
        const first = pool.execute(firstData)
        const quickData = { id: 'healthy-queued' }
        const quick = pool.execute(quickData)
        const later = pool
          .execute({ id: 'later-migrated' }, undefined, controller.signal)
          .catch(error => error)
        await bounded(Promise.all([sourceStarted, destinationStarted]))
        expect(source.tasksQueue.size).toBe(2)
        send(destination, { release: 'destination' })
        expect(await bounded(healthy)).toStrictEqual(healthyData)
        expect(await bounded(quick)).toStrictEqual(quickData)
        const exit = new Promise(resolve => source.worker.once('exit', resolve))
        send(source, { exitCode: 1 })
        await bounded(exit)
        expect(await bounded(failed)).toBeInstanceOf(Error)
        expect(await bounded(first)).toStrictEqual(firstData)
        expect(await bounded(later)).toBeInstanceOf(Error)
        expect(controller.signal.aborted).toBe(true)
        expect(executions.filter(id => id === 'first-migrated')).toHaveLength(1)
        expect(executions).not.toContain('later-migrated')
        expect(source.tasksQueue.size).toBe(0)
        expect(pool.promiseResponseMap.size).toBe(0)
      } finally {
        await pool.destroy()
      }
    })

    it('routes a queued task abort to its new owner after redistribution and index shifting', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        await pool.execute({ warmup: true })
        const [source, destination] = pool.workerNodes
        const sourceStarted = started(source, 'source')
        const destinationStarted = started(destination, 'destination')
        const sourceResult = pool
          .execute({ id: 'source', wait: true })
          .catch(error => error)
        const destinationData = { id: 'destination', wait: true }
        const destinationResult = pool.execute(destinationData)
        const controller = new AbortController()
        const queued = pool
          .execute({ id: 'aborted' }, undefined, controller.signal)
          .catch(error => error)
        await bounded(Promise.all([sourceStarted, destinationStarted]))
        const exit = new Promise(resolve => source.worker.once('exit', resolve))
        send(source, { crash: true })
        expect(await bounded(sourceResult)).toBeInstanceOf(Error)
        await bounded(exit)
        const reason = new Error('Cancel redistributed task')
        controller.abort(reason)
        expect(await bounded(queued)).toBeInstanceOf(Error)
        send(destination, { release: 'destination' })
        expect(await bounded(destinationResult)).toStrictEqual(destinationData)
        expect(destination.tasksQueue.size).toBe(0)
      } finally {
        await pool.destroy()
      }
    })
    it('can destroy the pool immediately after catching a worker failure', async () => {
      const pool = await createPool()
      const workerNode = pool.workerNodes[0]
      const running = started(workerNode, 'running')
      const result = pool
        .execute({ id: 'running', wait: true })
        .catch(error => error)
      await bounded(running)
      send(workerNode, { crash: true })
      expect(await bounded(result)).toBeInstanceOf(Error)
      await bounded(pool.destroy())
      expect(pool.info.started).toBe(false)
    })

    it('can destroy the pool from a busyEnd listener after a worker exits', async () => {
      const pool = await createPool()
      let destruction
      pool.emitter.once('busyEnd', () => {
        destruction = pool.destroy()
      })
      expect(
        await bounded(pool.execute({ exitCode: 1 }).catch(error => error))
      ).toBeInstanceOf(Error)
      await bounded(destruction)
      expect(pool.info.started).toBe(false)
    })

    it('does not attribute intentionally terminated tasks to a later crashed worker', async () => {
      const pool = await createPool(2)
      try {
        await pool.execute({ warmup: true })
        const [removed, survivor] = pool.workerNodes
        const removedStarted = started(removed, 'removed')
        const survivorStarted = started(survivor, 'survivor')
        let removedTaskSettled = false
        pool
          .execute({ id: 'removed', wait: true })
          .finally(() => {
            removedTaskSettled = true
          })
          .catch(() => {})
        const survivorResult = pool
          .execute({ id: 'survivor', wait: true })
          .catch(error => error)
        await bounded(Promise.all([removedStarted, survivorStarted]))
        await bounded(pool.destroyWorkerNode(0))
        send(survivor, { crash: true })
        expect(await bounded(survivorResult)).toBeInstanceOf(Error)
        expect(removedTaskSettled).toBe(false)
      } finally {
        await pool.destroy()
      }
    })

    if (workerType === 'thread') {
      it('settles an initial native transfer failure without retaining execution usage', async () => {
        const pool = await createPool()
        const channel = new MessageChannel()
        const transferredPort = structuredClone(channel.port1, {
          transfer: [channel.port1],
        })
        try {
          await bounded(pool.addTaskFunction('echo', data => ({ id: data.id })))
          const workerNode = pool.workerNodes[0]
          const error = await bounded(
            pool
              .execute({ port: channel.port1 }, 'echo', undefined, [
                channel.port1,
              ])
              .catch(error => error)
          )
          expect(error).toBeInstanceOf(Error)
          expect(error.name).toBe('DataCloneError')
          expect(pool.promiseResponseMap.size).toBe(0)
          expect(workerNode.usage.tasks.executing).toBe(0)
          expect(
            workerNode.getTaskFunctionWorkerUsage('echo').tasks.executing
          ).toBe(0)
          const data = { id: 'followup' }
          expect(await bounded(pool.execute(data, 'echo'))).toStrictEqual(data)
        } finally {
          channel.port1.close()
          channel.port2.close()
          transferredPort.close()
          if (pool.info.started) await bounded(pool.destroy())
        }
      })

      it('preserves a buffered response when a queued transfer fails during exit migration', async () => {
        const pool = await createPool(2, {
          enableTasksQueue: true,
          restartWorkerOnError: false,
          tasksQueueOptions: {
            concurrency: 1,
            tasksStealingOnBackPressure: false,
            taskStealing: false,
          },
        })
        const channel = new MessageChannel()
        let transferredPort
        const source = pool.workerNodes[0]
        try {
          await bounded(
            pool.addTaskFunction('migratingEcho', {
              taskFunction: data => ({ id: data.id }),
              workerNodeKeys: [0],
            })
          )
          await bounded(pool.execute({ warmup: true }))
          const destination = pool.workerNodes[1]
          source.messageChannel.port1.off('message', pool.workerMessageListener)
          const status = new Int32Array(new SharedArrayBuffer(4))
          const response = { completed: true }
          const result = pool.execute({
            exitAfterResponse: status.buffer,
            response,
          })
          const bad = pool
            .execute({ port: channel.port1 }, 'migratingEcho', undefined, [
              channel.port1,
            ])
            .catch(error => error)
          const laterData = { id: 'later' }
          const later = pool.execute(laterData, 'migratingEcho')
          expect(source.tasksQueue.size).toBe(2)
          transferredPort = structuredClone(channel.port1, {
            transfer: [channel.port1],
          })
          const exit = new Promise(resolve =>
            source.worker.once('exit', resolve)
          )
          Atomics.wait(status, 0, 0, 5000)
          expect(Atomics.load(status, 0)).toBe(1)
          const outcomes = await bounded(Promise.all([result, bad, later]))
          expect(outcomes[0]).toStrictEqual(response)
          expect(outcomes[1]).toBeInstanceOf(Error)
          expect(outcomes[1].name).toBe('DataCloneError')
          expect(outcomes[2]).toStrictEqual(laterData)
          await bounded(exit)
          expect(pool.promiseResponseMap.size).toBe(0)
          expect(source.tasksQueue.size).toBe(0)
          expect(destination.usage.tasks.executing).toBe(0)
          expect(
            destination.getTaskFunctionWorkerUsage('migratingEcho').tasks
              .executing
          ).toBe(0)
        } finally {
          channel.port1.close()
          channel.port2.close()
          transferredPort?.close()
          source.messageChannel.port1.close()
          source.messageChannel.port2.close()
          if (pool.info.started) await bounded(pool.destroy())
        }
      })

      it('does not wait for a taskFinished event for a failed transfer during destroy', async () => {
        const pool = await createPool(1, {
          enableTasksQueue: true,
          tasksQueueOptions: {
            concurrency: 1,
            tasksFinishedTimeout: 30000,
            tasksStealingOnBackPressure: false,
            taskStealing: false,
          },
        })
        const channel = new MessageChannel()
        let transferredPort
        try {
          const workerNode = pool.workerNodes[0]
          const runningStarted = started(workerNode, 'running')
          pool.execute({ id: 'running', wait: true }).catch(() => {})
          await bounded(runningStarted)
          const bad = pool
            .execute({ port: channel.port1 }, undefined, undefined, [
              channel.port1,
            ])
            .catch(error => error)
          transferredPort = structuredClone(channel.port1, {
            transfer: [channel.port1],
          })
          await bounded(pool.destroy())
          const error = await bounded(bad)
          expect(error).toBeInstanceOf(Error)
          expect(error.name).toBe('DataCloneError')
          expect(pool.info.started).toBe(false)
        } finally {
          channel.port1.close()
          channel.port2.close()
          transferredPort?.close()
          if (pool.info.started) await bounded(pool.destroy())
        }
      })

      for (const destinationBusy of [false, true]) {
        it(`isolates a queued transfer failure after worker exit (destination busy: ${destinationBusy})`, async () => {
          const pool = await createPool(2, {
            enableTasksQueue: true,
            restartWorkerOnError: false,
            tasksQueueOptions: {
              concurrency: 1,
              tasksStealingOnBackPressure: false,
              taskStealing: false,
            },
          })
          const channel = new MessageChannel()
          let transferredPort
          try {
            await bounded(pool.execute({ warmup: true }))
            const [source, destination] = pool.workerNodes
            const sourceStarted = started(source, 'source')
            const destinationStarted = started(destination, 'destination')
            const running = pool
              .execute({ id: 'source', wait: true })
              .catch(error => error)
            const healthyData = { id: 'destination', wait: true }
            const healthy = pool.execute(healthyData)
            await bounded(Promise.all([sourceStarted, destinationStarted]))
            await bounded(
              pool.addTaskFunction('migratingEcho', {
                taskFunction: data => ({ id: data.id }),
                workerNodeKeys: [0],
              })
            )
            const bad = pool
              .execute(
                { id: 'bad', port: channel.port1 },
                'migratingEcho',
                undefined,
                [channel.port1]
              )
              .catch(error => error)
            const laterData = { id: 'later' }
            const later = pool.execute(laterData, 'migratingEcho')
            expect(source.tasksQueue.size).toBe(2)
            transferredPort = structuredClone(channel.port1, {
              transfer: [channel.port1],
            })
            if (!destinationBusy) {
              send(destination, { release: 'destination' })
              expect(await bounded(healthy)).toStrictEqual(healthyData)
            }
            const exit = new Promise(resolve =>
              source.worker.once('exit', resolve)
            )
            send(source, { exitCode: 0 })
            await bounded(exit)
            if (destinationBusy) {
              expect(destination.tasksQueue.size).toBe(2)
              send(destination, { release: 'destination' })
              expect(await bounded(healthy)).toStrictEqual(healthyData)
            }
            const outcomes = await bounded(Promise.all([running, bad, later]))
            expect(outcomes[0]).toBeInstanceOf(Error)
            expect(outcomes[1]).toBeInstanceOf(Error)
            expect(outcomes[1].name).toBe('DataCloneError')
            expect(outcomes[2]).toStrictEqual(laterData)
            const followupData = { id: 'followup' }
            expect(await bounded(pool.execute(followupData))).toStrictEqual(
              followupData
            )
            expect(source.tasksQueue.size).toBe(0)
            expect(pool.promiseResponseMap.size).toBe(0)
            expect(destination.usage.tasks.executing).toBe(0)
            expect(
              destination.getTaskFunctionWorkerUsage('migratingEcho').tasks
                .executing
            ).toBe(0)
          } finally {
            channel.port1.close()
            channel.port2.close()
            transferredPort?.close()
            if (pool.info.started) await bounded(pool.destroy())
          }
        })
      }

      it('settles exited worker tasks when replacement construction throws', async () => {
        const { stdout } = await promisify(execFile)(
          process.execPath,
          [
            '--eval',
            `
              const { setImmediate } = require('node:timers/promises')
              const { MessageChannel } = require('node:worker_threads')
              const { FixedThreadPool } = require('./lib/index.cjs')

              const channel = new MessageChannel()
              let pool
              let exitedWorker
              const exitHandlerCalls = []
              const outcomes = []
              let observeException
              const exception = new Promise(resolve => {
                observeException = resolve
              })
              process.once('uncaughtException', observeException)

              ;(async () => {
                try {
                  pool = new FixedThreadPool(
                    1,
                    './tests/worker-files/thread/crashWorker.mjs',
                    {
                      enableTasksQueue: true,
                      exitHandler (exitCode) {
                        exitHandlerCalls.push({
                          exitCode,
                          receiverMatches: this === exitedWorker,
                        })
                      },
                      workerOptions: {
                        workerData: { port: channel.port1 },
                        transferList: [channel.port1],
                      },
                    }
                  )
                  const exitedNode = pool.workerNodes[0]
                  exitedWorker = exitedNode.worker
                  for (const data of [{ exitCode: 0 }, { id: 'queued' }]) {
                    const index = outcomes.length
                    outcomes.push({ status: 'pending' })
                    pool.execute(data).then(
                      () => { outcomes[index] = { status: 'fulfilled' } },
                      error => {
                        outcomes[index] = {
                          status: 'rejected',
                          reasonIsError: error instanceof Error,
                        }
                      }
                    )
                  }
                  const error = await exception
                  // Observe settlement after all rejection microtasks have run.
                  await setImmediate()
                  console.log(JSON.stringify({
                    exceptionName: error.name,
                    exitHandlerCalls,
                    outcomes,
                    detachedQueueSize: exitedNode.tasksQueue.size,
                    promiseResponseMapSize: pool.promiseResponseMap.size,
                    workerNodesLength: pool.workerNodes.length,
                    startingMinimumNumberOfWorkers: pool.startingMinimumNumberOfWorkers,
                  }))
                } finally {
                  try {
                    if (pool != null) await pool.destroy()
                  } finally {
                    channel.port1.close()
                    channel.port2.close()
                    process.off('uncaughtException', observeException)
                  }
                }
              })().catch(error => {
                console.error(error)
                process.exitCode = 1
              })
            `,
          ],
          { timeout: 10000 }
        )
        expect(JSON.parse(stdout)).toStrictEqual({
          detachedQueueSize: 0,
          exceptionName: 'DataCloneError',
          exitHandlerCalls: [{ exitCode: 0, receiverMatches: true }],
          outcomes: [
            { reasonIsError: true, status: 'rejected' },
            { reasonIsError: true, status: 'rejected' },
          ],
          promiseResponseMapSize: 0,
          startingMinimumNumberOfWorkers: false,
          workerNodesLength: 0,
        })
      })

      for (const [description, message] of [
        ['number', { crashWith: 42 }],
        ['string', { crashWith: 'Worker threw a string' }],
        ['false', { crashWith: false }],
        ['undefined', { crashWith: undefined }],
        [
          'object without coercion methods',
          { crashWith: { toString: null, valueOf: null } },
        ],
        ['Error', { crash: true }],
      ]) {
        it(`rejects a task with an Error after a native ${description} failure`, async () => {
          const pool = await createPool()
          try {
            const workerNode = pool.workerNodes[0]
            const running = started(workerNode, 'running')
            const result = pool
              .execute({ id: 'running', wait: true })
              .catch(error => error)
            await bounded(running)
            const nativeError = new Promise(resolve =>
              pool.emitter.once('error', resolve)
            )
            send(workerNode, message)
            const [error, rawWorkerError] = await bounded(
              Promise.all([result, nativeError])
            )
            expect(error).toBeInstanceOf(Error)
            if (Object.hasOwn(message, 'crashWith')) {
              expect(rawWorkerError).toStrictEqual(message.crashWith)
              expect(rawWorkerError).not.toBeInstanceOf(Error)
              expect(error.cause).toBe(rawWorkerError)
              if (message.crashWith === undefined) {
                expect(Object.hasOwn(error, 'cause')).toBe(true)
              }
              if (typeof message.crashWith === 'string') {
                expect(error.message).toBe(message.crashWith)
              }
            } else {
              expect(error).toBe(rawWorkerError)
            }
          } finally {
            await pool.destroy()
          }
        })
      }

      it('only calls the task execution hook for a live worker owner', async () => {
        const hookOwners = []
        const invalidKeys = []
        class LiveOwnerThreadPool extends FixedThreadPool {
          afterTaskExecutionHook (workerNodeKey, message) {
            const workerNode = this.workerNodes[workerNodeKey]
            if (workerNode == null) {
              invalidKeys.push(workerNodeKey)
              return
            }
            hookOwners.push(workerNode)
            super.afterTaskExecutionHook(workerNodeKey, message)
          }
        }
        const pool = new LiveOwnerThreadPool(1, workerFile, {
          enableTasksQueue: true,
          tasksQueueOptions: {
            concurrency: 1,
            tasksStealingOnBackPressure: false,
            taskStealing: false,
          },
        })
        pool.emitter.on('error', () => {})
        let workerNode
        try {
          if (!pool.info.ready) await bounded(once(pool.emitter, 'ready'))
          workerNode = pool.workerNodes[0]
          const controlData = { control: true }
          expect(await bounded(pool.execute(controlData))).toStrictEqual(
            controlData
          )
          expect(hookOwners).toHaveLength(1)
          expect(hookOwners[0]).toBe(workerNode)
          workerNode.messageChannel.port1.off(
            'message',
            pool.workerMessageListener
          )
          const status = new Int32Array(new SharedArrayBuffer(4))
          const exit = new Promise(resolve =>
            workerNode.worker.once('exit', resolve)
          )
          const response = { completed: true }
          const result = pool.execute({
            exitAfterResponse: status.buffer,
            response,
          })
          const stranded = pool
            .execute({ id: 'stranded' })
            .catch(error => error)
          expect(workerNode.tasksQueue.size).toBe(1)
          Atomics.wait(status, 0, 0, 5000)
          expect(Atomics.load(status, 0)).toBe(1)
          const outcomes = await bounded(Promise.all([result, stranded]))
          expect(outcomes[0]).toStrictEqual(response)
          expect(outcomes[1]).toBeInstanceOf(Error)
          await bounded(exit)
          expect(hookOwners).toHaveLength(1)
          expect(invalidKeys).toStrictEqual([])
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          workerNode?.messageChannel?.port1.close()
          workerNode?.messageChannel?.port2.close()
          if (pool.info.started) await bounded(pool.destroy())
        }
      })

      for (const [crashAfterResponse, fail] of [
        [false, false],
        [false, true],
        [true, false],
        [true, true],
      ]) {
        it(`preserves a buffered response after exit (task failure: ${fail}, uncaught error: ${crashAfterResponse})`, async () => {
          const pool = await createPool()
          const workerNode = pool.workerNodes[0]
          // Keep real responses buffered until the native exit notification.
          workerNode.messageChannel.port1.off(
            'message',
            pool.workerMessageListener
          )
          let destruction
          if (fail) {
            pool.emitter.once('taskError', () => {
              destruction = pool.destroy()
            })
          }
          try {
            const status = new Int32Array(new SharedArrayBuffer(4))
            const exit = new Promise(resolve =>
              workerNode.worker.once('exit', resolve)
            )
            const response = { completed: true }
            const result = pool
              .execute({
                crashAfterResponse,
                exitAfterResponse: status.buffer,
                fail,
                response,
              })
              .catch(error => error)
            // Hold the main loop until the worker posts its response and exits.
            Atomics.wait(status, 0, 0, 5000)
            expect(Atomics.load(status, 0)).toBe(1)
            if (fail) {
              const error = await bounded(result)
              expect(error).toBeInstanceOf(Error)
              expect(error.message).toBe('Task failed before worker exit')
              await bounded(destruction)
              expect(pool.info.started).toBe(false)
            } else {
              expect(await bounded(result)).toStrictEqual(response)
            }
            await bounded(exit)
          } finally {
            workerNode.messageChannel?.port1.close()
            workerNode.messageChannel?.port2.close()
            if (pool.info.started) await pool.destroy()
          }
        })
      }
    }

    if (workerType === 'cluster') {
      it('migrates queued work after aborting a disconnected cluster worker task', async () => {
        const pool = await createPool(2, {
          enableTasksQueue: true,
          restartWorkerOnError: false,
          tasksQueueOptions: {
            concurrency: 1,
            tasksStealingOnBackPressure: false,
            taskStealing: false,
          },
        })
        const source = pool.workerNodes[0]
        const healthyNode = pool.workerNodes[1]
        try {
          await bounded(pool.execute({ warmup: true }))
          const controller = new AbortController()
          const sourceStarted = started(source, 'disconnected')
          const failed = pool
            .execute(
              { id: 'disconnected', wait: true },
              undefined,
              controller.signal
            )
            .catch(error => error)
          const healthyStarted = started(healthyNode, 'healthy')
          const healthyData = { id: 'healthy', wait: true }
          const healthy = pool.execute(healthyData).catch(error => error)
          await bounded(Promise.all([sourceStarted, healthyStarted]))
          const queuedData = { id: 'queued-before-disconnect' }
          const queued = pool.execute(queuedData).catch(error => error)
          expect(source.tasksQueue.size).toBe(1)
          const disconnect = once(source.worker, 'disconnect')
          send(source, { disconnect: true })
          await bounded(disconnect)
          expect(source.worker.isDead()).toBe(false)
          const exit = new Promise(resolve =>
            source.worker.once('exit', resolve)
          )
          controller.abort()
          await bounded(exit)
          expect(await bounded(failed)).toBeInstanceOf(Error)
          send(healthyNode, { release: 'healthy' })
          expect(await bounded(healthy)).toStrictEqual(healthyData)
          expect(await bounded(queued)).toStrictEqual(queuedData)
          expect(source.tasksQueue.size).toBe(0)
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          await cleanupRegressionPool(pool, [source, healthyNode])
        }
      })
    }

    it.each(['healthy-flush', 'detached-migration'])(
      'defers backPressureEnd until fullEnd queue-disable handoffs finish (%s)',
      async abortTarget => {
        const DynamicPoolClass =
          workerType === 'thread' ? DynamicThreadPool : DynamicClusterPool
        const pool = new DynamicPoolClass(1, 2, workerFile, {
          enableTasksQueue: true,
          restartWorkerOnError: false,
          tasksQueueOptions: {
            concurrency: 1,
            size: 1,
            tasksStealingOnBackPressure: false,
            taskStealing: false,
          },
          workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
        })
        pool.emitter.on('error', () => {})
        const capturedNodes = new Set(pool.workerNodes)
        try {
          if (!pool.info.ready) await bounded(once(pool.emitter, 'ready'))
          const minimumNode = pool.workerNodes[0]
          const minimumStarted = started(minimumNode, 'minimum')
          const minimumData = { id: 'minimum', wait: true }
          const minimum = pool.execute(minimumData).catch(error => error)
          await bounded(minimumStarted)
          const full = once(pool.emitter, 'full')
          const failed = pool
            .execute({ id: 'dynamic', wait: true })
            .catch(error => error)
          const source = pool.workerNodes[1]
          capturedNodes.add(source)
          await bounded(Promise.all([full, started(source, 'dynamic')]))
          for (const [name, workerNodeKeys] of [
            ['cursorEcho', [0]],
            ['migratingEcho', [0, 1]],
          ]) {
            await bounded(
              pool.addTaskFunction(name, {
                taskFunction: async data =>
                  data.wait ? await new Promise(() => {}) : data,
                workerNodeKeys,
              })
            )
          }
          const controller = new AbortController()
          const abortReason = new Error(`Abort ${abortTarget} after handoff`)
          const healthyData = {
            id: 'healthy-queued',
            wait: abortTarget === 'healthy-flush',
          }
          const detachedData = {
            id: 'detached-queued',
            wait: abortTarget === 'detached-migration',
          }
          const backPressure = once(pool.emitter, 'backPressure')
          const healthy = pool
            .execute(
              healthyData,
              'cursorEcho',
              abortTarget === 'healthy-flush' ? controller.signal : undefined
            )
            .catch(error => error)
          const healthyWrapper = [...pool.promiseResponseMap.values()].at(-1)
          const detached = pool
            .execute(
              detachedData,
              'migratingEcho',
              abortTarget === 'detached-migration'
                ? controller.signal
                : undefined
            )
            .catch(error => error)
          const detachedWrapper = [...pool.promiseResponseMap.values()].at(-1)
          await bounded(backPressure)
          expect(minimumNode.tasksQueue.size).toBe(1)
          expect(source.tasksQueue.size).toBe(1)
          let fullEndCalls = 0
          let endState
          pool.emitter.once('fullEnd', () => {
            ++fullEndCalls
            pool.enableTasksQueue(false)
          })
          pool.emitter.once('backPressureEnd', () => {
            endState = {
              detachedOwner: detachedWrapper.workerNodeKey,
              executing: minimumNode.usage.tasks.executing,
              healthyOwner: healthyWrapper.workerNodeKey,
              sourceQueue: source.tasksQueue.size,
            }
            controller.abort(abortReason)
          })
          const exit = new Promise(resolve =>
            source.worker.once('exit', resolve)
          )
          send(source, { crash: true })
          await bounded(exit)
          expect(await bounded(failed)).toBeInstanceOf(Error)
          expect(
            await bounded(abortTarget === 'healthy-flush' ? healthy : detached)
          ).toBe(abortReason)
          expect(
            await bounded(abortTarget === 'healthy-flush' ? detached : healthy)
          ).toStrictEqual(
            abortTarget === 'healthy-flush' ? detachedData : healthyData
          )
          expect(endState).toStrictEqual({
            detachedOwner: 0,
            executing: 3,
            healthyOwner: 0,
            sourceQueue: 0,
          })
          expect(fullEndCalls).toBe(1)
          send(minimumNode, { release: 'minimum' })
          expect(await bounded(minimum)).toStrictEqual(minimumData)
          expect(minimumNode.tasksQueue.size).toBe(0)
          expect(source.tasksQueue.size).toBe(0)
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          await cleanupRegressionPool(pool, capturedNodes)
        }
      }
    )

    it.each([
      new Error('Detached task cancelled'),
      'Detached task cancelled',
      42,
    ])(
      'preserves a detached task abort reason from fullEnd (%s)',
      async abortReason => {
        const DynamicPoolClass =
          workerType === 'thread' ? DynamicThreadPool : DynamicClusterPool
        const executions = []
        class ObservedDynamicPool extends DynamicPoolClass {
          beforeTaskExecutionHook (workerNodeKey, task) {
            executions.push(task.data?.id)
            super.beforeTaskExecutionHook(workerNodeKey, task)
          }
        }
        const pool = new ObservedDynamicPool(1, 2, workerFile, {
          enableTasksQueue: true,
          tasksQueueOptions: {
            concurrency: 1,
            tasksStealingOnBackPressure: false,
            taskStealing: false,
          },
          workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
        })
        pool.emitter.on('error', () => {})
        const capturedNodes = new Set(pool.workerNodes)
        try {
          if (!pool.info.ready) await bounded(once(pool.emitter, 'ready'))
          const minimumNode = pool.workerNodes[0]
          const minimumStarted = started(minimumNode, 'minimum')
          const minimumData = { id: 'minimum', wait: true }
          const minimum = pool.execute(minimumData).catch(error => error)
          await bounded(minimumStarted)
          const full = once(pool.emitter, 'full')
          const failed = pool
            .execute({ id: 'dynamic', wait: true })
            .catch(error => error)
          const source = pool.workerNodes[1]
          capturedNodes.add(source)
          await bounded(Promise.all([full, started(source, 'dynamic')]))
          await bounded(
            pool.addTaskFunction('cursorEcho', {
              taskFunction: data => data,
              workerNodeKeys: [0],
            })
          )
          await bounded(
            pool.addTaskFunction('migratingEcho', {
              taskFunction: data => data,
              workerNodeKeys: [0, 1],
            })
          )
          const cursorData = { id: 'cursor' }
          const cursor = pool
            .execute(cursorData, 'cursorEcho')
            .catch(error => error)
          const controller = new AbortController()
          const target = pool
            .execute({ id: 'detached' }, 'migratingEcho', controller.signal)
            .catch(error => error)
          expect(source.tasksQueue.size).toBe(1)
          let fullEndCalls = 0
          pool.emitter.once('fullEnd', () => {
            ++fullEndCalls
            controller.abort(abortReason)
          })
          const exit = new Promise(resolve =>
            source.worker.once('exit', resolve)
          )
          send(source, { exitCode: 1 })
          await bounded(exit)
          expect(await bounded(failed)).toBeInstanceOf(Error)
          const aborted = await bounded(target)
          if (abortReason instanceof Error) {
            expect(aborted).toBe(abortReason)
          } else {
            expect(aborted).toBeInstanceOf(Error)
            if (typeof abortReason === 'string') {
              expect(aborted.message).toBe(abortReason)
            } else {
              expect(aborted.message).toMatch(
                /^Task 'migratingEcho' id '[\da-f-]+' aborted$/
              )
            }
          }
          expect(fullEndCalls).toBe(1)
          expect(controller.signal.aborted).toBe(true)
          expect(executions).not.toContain('detached')
          expect(minimumNode.tasksQueue.size).toBe(1)
          send(minimumNode, { release: 'minimum' })
          expect(await bounded(minimum)).toStrictEqual(minimumData)
          expect(await bounded(cursor)).toStrictEqual(cursorData)
          expect(source.tasksQueue.size).toBe(0)
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          await cleanupRegressionPool(pool, capturedNodes)
        }
      }
    )

    it('rejects an exited dynamic worker task and accepts subsequent work', async () => {
      const DynamicPoolClass =
        workerType === 'thread' ? DynamicThreadPool : DynamicClusterPool
      const pool = new DynamicPoolClass(0, 1, workerFile)
      pool.emitter.on('error', () => {})
      try {
        expect(
          await bounded(pool.execute({ exitCode: 1 }).catch(error => error))
        ).toBeInstanceOf(Error)
        const data = { recovered: true }
        expect(await bounded(pool.execute(data))).toStrictEqual(data)
      } finally {
        await pool.destroy()
      }
    })
  })
}

describe('thread worker exit bootstrap affinity metadata', { retry: 0 }, () => {
  const bootstrapMessage = (workerNode, predicate) =>
    new Promise(resolve => {
      const listener = message => {
        if (predicate(message)) {
          workerNode.worker.off('message', listener)
          resolve(message)
        }
      }
      workerNode.worker.on('message', listener)
    })

  const metadataReady = workerNode => {
    if (workerNode.info.taskFunctionsProperties?.length > 0) {
      return Promise.resolve()
    }
    return new Promise(resolve => {
      const listener = message => {
        if (message.ready === true && message.taskFunctionsProperties != null) {
          workerNode.messageChannel.port1.off('message', listener)
          resolve()
        }
      }
      workerNode.messageChannel.port1.on('message', listener)
    })
  }

  it.each([
    { mode: 'named pinned rejection', reject: true },
    { defaultPinned: true, mode: 'default pinned rejection', reject: true },
    { mode: 'legal pinned migration after compaction', sourceIndex: 0 },
    { mode: 'unrestricted migration', unrestricted: true },
    { live: true, mode: 'live unrestricted metadata precedence' },
    {
      defaultPinned: true,
      live: true,
      mode: 'live default mapping precedence',
    },
  ])(
    'preserves bootstrap affinity metadata: $mode',
    async ({
      defaultPinned = false,
      live = false,
      reject = false,
      sourceIndex = 1,
      unrestricted = false,
    }) => {
      const status = new Int32Array(new SharedArrayBuffer(8))
      const targetIndex = 1 - sourceIndex
      const roles = [{}, {}]
      roles[sourceIndex] = {
        defaultPinned,
        workerNodeKeys: [sourceIndex],
      }
      const pool = new DynamicThreadPool(
        0,
        2,
        './tests/worker-files/thread/bootstrapAffinityWorker.mjs',
        {
          enableTasksQueue: true,
          restartWorkerOnError: false,
          tasksQueueOptions: {
            concurrency: 1,
            tasksStealingOnBackPressure: false,
            taskStealing: false,
          },
          workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
          workerOptions: {
            workerData: {
              blockedRole: targetIndex,
              bootstrapStatus: status.buffer,
              roles,
            },
          },
        }
      )
      pool.emitter.on('error', () => {})
      const capturedNodes = []
      const held = []
      const releaseBootstrap = () => {
        Atomics.store(status, 1, 1)
        Atomics.notify(status, 1)
      }
      try {
        held.push(
          pool
            .execute({ id: 'held-0', wait: true }, 'echo')
            .catch(error => error)
        )
        capturedNodes.push(pool.workerNodes[0])
        const heldStarted = [started(capturedNodes[0], 'held-0')]
        const firstClaim = await bounded(
          bootstrapMessage(
            capturedNodes[0],
            message => message.bootstrapRole === 0
          )
        )
        expect(firstClaim.blocked).toBe(targetIndex === 0)
        // The first native claim must arrive before the second worker can claim.
        if (sourceIndex === 0) {
          await bounded(metadataReady(capturedNodes[0]))
        }
        held.push(
          pool
            .execute({ id: 'held-1', wait: true }, 'echo')
            .catch(error => error)
        )
        capturedNodes.push(pool.workerNodes[1])
        heldStarted.push(started(capturedNodes[1], 'held-1'))
        const secondClaim = await bounded(
          bootstrapMessage(
            capturedNodes[1],
            message => message.bootstrapRole === 1
          )
        )
        expect(secondClaim.blocked).toBe(targetIndex === 1)
        const source = capturedNodes[sourceIndex]
        const target = capturedNodes[targetIndex]
        const targetStarted = heldStarted[targetIndex]
        await bounded(
          Promise.all([metadataReady(source), heldStarted[sourceIndex]])
        )
        expect(
          source.info.taskFunctionsProperties.find(
            properties => properties.name === 'pinned'
          ).workerNodeKeys
        ).toStrictEqual([sourceIndex])
        if (defaultPinned) {
          expect(source.info.taskFunctionsProperties[1].name).toBe('pinned')
        }
        expect(target.info.taskFunctionsProperties ?? []).toHaveLength(0)
        expect(target.info.ready).toBe(true)
        let filler
        if (unrestricted) {
          filler = pool.execute({ id: 'filler' }, 'echo').catch(error => error)
          expect(target.tasksQueue.size).toBe(1)
        }
        const queuedData = { id: 'queued' }
        const queued = pool
          .execute(
            queuedData,
            defaultPinned ? undefined : unrestricted ? 'echo' : 'pinned'
          )
          .catch(error => error)
        const queuedTaskId = [...pool.promiseResponseMap.keys()].at(-1)
        expect(source.tasksQueue.size).toBe(1)
        if (live) {
          const ready = metadataReady(target)
          releaseBootstrap()
          await bounded(Promise.all([ready, targetStarted]))
          expect(
            target.info.taskFunctionsProperties.find(
              properties => properties.name === 'pinned'
            ).workerNodeKeys
          ).toBeUndefined()
          if (defaultPinned) {
            expect(target.info.taskFunctionsProperties[1].name).toBe('echo')
          }
        }
        const exit = new Promise(resolve => source.worker.once('exit', resolve))
        send(source, { exitCode: 0 })
        await bounded(exit)
        expect(await bounded(held[sourceIndex])).toBeInstanceOf(Error)
        expect(pool.workerNodes).toStrictEqual([target])
        expect(source.tasksQueue.size).toBe(0)
        if (reject) {
          // Fail before unblocking or cleanup can execute a forbidden migration.
          expect(target.info.taskFunctionsProperties ?? []).toHaveLength(0)
          expect(target.tasksQueue.size).toBe(0)
          expect(pool.promiseResponseMap.has(queuedTaskId)).toBe(false)
          expect(await bounded(queued)).toBeInstanceOf(Error)
        } else {
          expect(target.tasksQueue.size).toBe(unrestricted ? 2 : 1)
        }
        releaseBootstrap()
        await bounded(targetStarted)
        send(target, { release: `held-${targetIndex}` })
        expect(await bounded(held[targetIndex])).toMatchObject({
          id: `held-${targetIndex}`,
          workerId: target.info.id,
        })
        if (!reject) {
          expect(await bounded(queued)).toStrictEqual({
            ...queuedData,
            taskFunction: defaultPinned || unrestricted ? 'echo' : 'pinned',
            workerId: target.info.id,
          })
        }
        if (filler != null) {
          expect(await bounded(filler)).toMatchObject({
            id: 'filler',
            workerId: target.info.id,
          })
        }
        expect(pool.promiseResponseMap.size).toBe(0)
      } finally {
        releaseBootstrap()
        await cleanupRegressionPool(pool, capturedNodes)
      }
    }
  )
})
