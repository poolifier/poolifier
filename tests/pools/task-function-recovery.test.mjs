import { once } from 'node:events'
import { describe, expect, it } from 'vitest'

import {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  PoolEvents,
  WorkerChoiceStrategies,
} from '../../lib/index.mjs'
import { bounded, waitForMessage } from '../test-utils.cjs'

const workerFile = './tests/worker-files/taskFunctionRecoveryWorker.mjs'

const outcome = promise =>
  promise.then(
    value => ({ value }),
    error => ({ error })
  )

const identify = function (data) {
  return { ...data, workerId: this.id }
}

describe.each([
  ['thread', FixedThreadPool, DynamicThreadPool],
  ['cluster', FixedClusterPool, DynamicClusterPool],
])('%s task function recovery', (workerType, FixedPool, DynamicPool) => {
  const control = async (node, message) => {
    const acknowledged = waitForMessage(
      node.worker,
      response => response.control === message.control
    )
    message = { ...message, workerId: node.info.id }
    if (workerType === 'thread') node.worker.postMessage(message)
    else node.worker.send(message)
    await bounded(acknowledged)
  }

  it('uses captured affinity when an ineligible worker rejects replay', async () => {
    const pool = new DynamicPool(0, 3, workerFile)
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    const send = pool.sendToWorker.bind(pool)
    let injected = false
    pool.sendToWorker = (key, message) => {
      if (
        !injected &&
        key === 0 &&
        message.taskFunctionOperation === 'add' &&
        message.taskFunctionProperties.name === 'runtime'
      ) {
        injected = true
        message = {
          ...message,
          taskFunctionProperties: {
            ...message.taskFunctionProperties,
            priority: 1000,
          },
        }
      }
      send(key, message)
    }
    let execution
    try {
      await bounded(
        pool.addTaskFunction('runtime', {
          taskFunction: identify,
          workerNodeKeys: [2],
        })
      )
      const failed = once(pool.emitter, PoolEvents.error)
      execution = outcome(pool.execute({ input: 42 }, 'runtime'))
      const result = await bounded(execution)
      await bounded(failed)
      expect(result).toEqual({
        value: expect.objectContaining({ input: 42 }),
      })
      expect(pool.workerNodes).toHaveLength(3)
      expect(result.value.workerId).toBe(pool.workerNodes[2].info.id)
      expect(pool.workerNodes[0].info.ready).toBe(false)
      expect(errors).toEqual([expect.any(Error)])
    } finally {
      await bounded(pool.destroy())
      await bounded(Promise.allSettled([execution]))
    }
  })

  it('uses captured default affinity when only an unready worker has metadata', async () => {
    const pool = new DynamicPool(1, 3, workerFile)
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      await bounded(
        pool.addTaskFunction('runtime', {
          taskFunction: identify,
          workerNodeKeys: [2],
        })
      )
      await bounded(pool.setDefaultTaskFunction('runtime'))
      await bounded(pool.destroy())
      const send = pool.sendToWorker.bind(pool)
      let injected = false
      pool.sendToWorker = (key, message) => {
        if (!injected && key === 0 && message.taskFunctionOperation === 'add') {
          injected = true
          message = {
            ...message,
            taskFunctionProperties: {
              ...message.taskFunctionProperties,
              priority: 1000,
            },
          }
        }
        send(key, message)
      }
      const failed = once(pool.emitter, PoolEvents.error)
      pool.start()
      await bounded(failed)
      expect(pool.workerNodes[0].info.ready).toBe(false)
      expect(await bounded(pool.execute({ input: 42 }))).toEqual({
        input: 42,
        workerId: pool.workerNodes[2].info.id,
      })
      expect(pool.workerNodes).toHaveLength(3)
      expect(errors).toEqual([expect.any(Error)])
    } finally {
      if (pool.info.started) await bounded(pool.destroy())
    }
  })

  it('corrects invalid captured source and restores every desired function', async () => {
    const pool = new FixedPool(1, workerFile, { startWorkers: false })
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    try {
      const invalid = data => data + 1
      invalid.toString = () => 'null'
      await bounded(pool.addTaskFunction('runtime', invalid))
      await bounded(pool.addTaskFunction('later', data => data + 2))
      const failed = once(pool.emitter, PoolEvents.error)
      pool.start()
      const node = pool.workerNodes[0]
      await bounded(failed)
      expect(node.info.ready).toBe(false)
      expect(
        await bounded(pool.addTaskFunction('runtime', data => data + 1))
      ).toBe(true)
      expect(await bounded(pool.execute(42, 'runtime'))).toBe(43)
      expect(await bounded(pool.execute(42, 'later'))).toBe(44)
      expect(pool.workerNodes[0]).toBe(node)
      expect(node.info.ready).toBe(true)
      expect(errors).toEqual([expect.any(Error)])
    } finally {
      await bounded(pool.destroy())
    }
  })

  it.each([false, true])(
    'discards failed registrations with reconstructed requests: %s',
    async legacy => {
      const pool = new FixedPool(
        1,
        legacy
          ? workerType === 'thread'
            ? './tests/worker-files/thread/taskLifecycleWorker.mjs'
            : './tests/worker-files/cluster/legacyTaskFunctionWorker.mjs'
          : workerFile,
        {
          startWorkers: false,
          ...(legacy &&
            workerType === 'thread' && {
            workerOptions: {
              workerData: { legacyTaskFunctionMessages: true },
            },
          }),
        }
      )
      const errors = []
      pool.emitter.on(PoolEvents.error, error => errors.push(error))
      try {
        const invalid = () => 'invalid'
        invalid.toString = () => 'null'
        await bounded(pool.addTaskFunction('bad', invalid))
        await bounded(pool.addTaskFunction('later', data => data + 2))
        const failed = once(pool.emitter, PoolEvents.error)
        pool.start()
        const node = pool.workerNodes[0]
        await bounded(failed)
        expect(await bounded(pool.removeTaskFunction('bad'))).toBe(true)
        expect(pool.workerNodes[0]).toBe(node)
        expect(node.info.ready).toBe(true)
        expect(await bounded(pool.execute(40, 'later'))).toBe(42)
        await expect(bounded(pool.execute({}, 'bad'))).rejects.toThrow(Error)
        await bounded(pool.destroy())
        pool.start()
        expect(await bounded(pool.execute(40, 'later'))).toBe(42)
        expect(pool.hasTaskFunction('bad')).toBe(false)
        expect(errors).toEqual([expect.any(Error)])
      } finally {
        if (pool.info.started) await bounded(pool.destroy())
      }
    }
  )

  it('removes a registration from mixed ready and failed workers', async () => {
    const pool = new FixedPool(2, workerFile, {
      startWorkers: false,
      workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
    })
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    try {
      await bounded(pool.addTaskFunction('bad', data => data))
      await bounded(pool.addTaskFunction('later', identify))
      const send = pool.sendToWorker.bind(pool)
      let injected = false
      pool.sendToWorker = (key, message) => {
        if (
          !injected &&
          key === 0 &&
          message.taskFunctionOperation === 'add' &&
          message.taskFunctionProperties.name === 'bad'
        ) {
          injected = true
          message = {
            ...message,
            taskFunctionProperties: {
              ...message.taskFunctionProperties,
              priority: 1000,
            },
          }
        }
        send(key, message)
      }
      const failed = once(pool.emitter, PoolEvents.error)
      pool.start()
      const nodes = [...pool.workerNodes]
      await bounded(failed)
      expect(await bounded(pool.removeTaskFunction('bad'))).toBe(true)
      const results = []
      for (let i = 0; i < 2; ++i) {
        results.push(await bounded(pool.execute({ restored: true }, 'later')))
      }
      expect(new Set(results.map(result => result.workerId))).toEqual(
        new Set(nodes.map(node => node.info.id))
      )
      expect(results.every(result => result.restored)).toBe(true)
      expect(pool.workerNodes).toEqual(nodes)
      await expect(bounded(pool.execute({}, 'bad'))).rejects.toThrow(Error)
      expect(errors).toEqual([expect.any(Error)])
    } finally {
      await bounded(pool.destroy())
    }
  })

  it('discards skipped registrations without losing repeated recovery failures', async () => {
    const pool = new FixedPool(1, workerFile, { startWorkers: false })
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    try {
      const invalid = () => 'invalid'
      invalid.toString = () => 'null'
      await bounded(pool.addTaskFunction('bad', invalid))
      await bounded(pool.addTaskFunction('discard', () => 'discard'))
      await bounded(pool.addTaskFunction('later', () => 'later'))
      let failed = once(pool.emitter, PoolEvents.error)
      pool.start()
      const node = pool.workerNodes[0]
      await bounded(failed)
      failed = once(pool.emitter, PoolEvents.error)
      expect(await bounded(pool.removeTaskFunction('discard'))).toBe(true)
      await bounded(failed)
      expect(node.info.ready).toBe(false)
      expect(await bounded(pool.removeTaskFunction('bad'))).toBe(true)
      expect(pool.workerNodes[0]).toBe(node)
      expect(await bounded(pool.execute({}, 'later'))).toBe('later')
      await expect(bounded(pool.execute({}, 'discard'))).rejects.toThrow(Error)
      expect(errors).toEqual([expect.any(Error), expect.any(Error)])
    } finally {
      await bounded(pool.destroy())
    }
  })

  it('preserves selected-default removal errors on a failed worker', async () => {
    const pool = new FixedPool(1, workerFile, { startWorkers: false })
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    try {
      const invalid = () => 'invalid'
      invalid.toString = () => 'null'
      await bounded(pool.addTaskFunction('bad', invalid))
      await bounded(pool.addTaskFunction('echo', data => data))
      const failed = once(pool.emitter, PoolEvents.error)
      pool.start()
      const node = pool.workerNodes[0]
      await bounded(failed)
      await expect(bounded(pool.removeTaskFunction('echo'))).rejects.toThrow(
        Error
      )
      expect(node.info.ready).toBe(false)
      expect(await bounded(pool.removeTaskFunction('bad'))).toBe(true)
      expect(pool.workerNodes[0]).toBe(node)
      expect(await bounded(pool.execute(42))).toBe(42)
      expect(errors).toEqual([expect.any(Error)])
    } finally {
      await bounded(pool.destroy())
    }
  })

  it('preserves custom errorless removal refusals after failed replay', async () => {
    const pool = new FixedPool(1, workerFile, { startWorkers: false })
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    try {
      const invalid = () => 'invalid'
      invalid.toString = () => 'null'
      await bounded(pool.addTaskFunction('bad', invalid))
      const failed = once(pool.emitter, PoolEvents.error)
      pool.start()
      const node = pool.workerNodes[0]
      await bounded(failed)
      await control(node, { control: 'refuseRemoval', name: 'bad' })
      await expect(bounded(pool.removeTaskFunction('bad'))).rejects.toThrow(
        Error
      )
      expect(node.info.ready).toBe(false)
      await control(node, { control: 'refuseRemoval' })
      expect(await bounded(pool.removeTaskFunction('bad'))).toBe(true)
      expect(pool.workerNodes[0]).toBe(node)
      expect(await bounded(pool.execute(42))).toBe(42)
      expect(errors).toEqual([expect.any(Error)])
    } finally {
      await bounded(pool.destroy())
    }
  })

  it('preserves missing-registration failures on ready workers', async () => {
    const pool = new FixedPool(1, workerFile)
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      await bounded(pool.addTaskFunction('bad', data => data))
      await bounded(
        pool.addTaskFunction('removeLocal', function () {
          return this.removeTaskFunction('bad').status
        })
      )
      expect(await bounded(pool.execute({}, 'removeLocal'))).toBe(true)
      await expect(bounded(pool.removeTaskFunction('bad'))).rejects.toThrow(
        Error
      )
      expect(await bounded(pool.addTaskFunction('bad', () => 43))).toBe(true)
      expect(await bounded(pool.execute({}, 'bad'))).toBe(43)
    } finally {
      await bounded(pool.destroy())
    }
  })

  it.each([
    ['acknowledgement', 2],
    ['failure', 2],
    ['exit', 2],
    ['acknowledgement', 3],
    ['failure', 3],
    ['exit', 3],
  ])(
    'keeps earlier sent mutations pending until their %s with %i workers',
    async (completion, size) => {
      const pool = new FixedPool(size, workerFile, {
        workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      })
      const errors = []
      pool.emitter.on(PoolEvents.error, error => errors.push(error))
      const originalError = new Error('Injected pre-dispatch send failure')
      let removal
      let addition
      let heldNode
      try {
        await bounded(once(pool.emitter, PoolEvents.ready))
        await bounded(pool.addTaskFunction('runtime', () => 'old'))
        if (size === 3) {
          await bounded(
            pool.addTaskFunction('inspect', {
              taskFunction: function () {
                return this.hasTaskFunction('runtime').status
              },
              workerNodeKeys: [2],
            })
          )
        }
        heldNode = pool.workerNodes[0]
        if (completion === 'failure') {
          await bounded(
            pool.sendTaskFunctionOperationToWorker(0, {
              taskFunctionOperation: 'default',
              taskFunctionProperties: { name: 'runtime' },
            })
          )
        }
        await control(heldNode, {
          control: 'hold',
          name: 'runtime',
          operation: 'remove',
        })
        const held = waitForMessage(
          heldNode.worker,
          message => message.heldOperation === 'remove'
        )
        const send = pool.sendToWorker.bind(pool)
        let injected = false
        pool.sendToWorker = (key, message) => {
          if (
            !injected &&
            key === 1 &&
            message.taskFunctionOperation === 'remove'
          ) {
            injected = true
            throw originalError
          }
          send(key, message)
        }
        let settled = false
        removal = outcome(pool.removeTaskFunction('runtime')).then(result => {
          settled = true
          return result
        })
        addition = outcome(pool.addTaskFunction('runtime', () => 'new'))
        await bounded(held)
        expect(await bounded(pool.execute({}, 'runtime'))).toBe('old')
        expect(settled).toBe(false)
        if (size === 3) {
          expect(await bounded(pool.execute({}, 'inspect'))).toBe(true)
        }
        if (completion === 'exit') {
          await bounded(heldNode.terminate())
        } else {
          await control(heldNode, { control: 'release' })
        }
        expect((await bounded(removal)).error).toBe(originalError)
        expect(await bounded(addition)).toEqual({ value: true })
        for (let i = 0; i < size; ++i) {
          expect(await bounded(pool.execute({}, 'runtime'))).toBe('new')
        }
        expect(errors).toEqual([])
      } finally {
        if (heldNode != null && pool.workerNodes.includes(heldNode)) {
          await control(heldNode, { control: 'release' })
        }
        await bounded(pool.destroy())
        await bounded(Promise.allSettled([removal, addition]))
      }
    }
  )

  it('preserves an undefined send error when no target was contacted', async () => {
    const pool = new FixedPool(1, workerFile)
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      await bounded(pool.addTaskFunction('runtime', () => 'old'))
      const send = pool.sendToWorker.bind(pool)
      const originalError = undefined
      let injected = false
      pool.sendToWorker = (key, message) => {
        if (!injected && message.taskFunctionOperation === 'remove') {
          injected = true
          throw originalError
        }
        send(key, message)
      }
      expect(
        await bounded(outcome(pool.removeTaskFunction('runtime')))
      ).toEqual({
        error: originalError,
      })
      expect(await bounded(pool.addTaskFunction('runtime', () => 'new'))).toBe(
        true
      )
      expect(await bounded(pool.execute({}, 'runtime'))).toBe('new')
    } finally {
      await bounded(pool.destroy())
    }
  })

  it('uses live worker defaults after a pool-wide default changes locally', async () => {
    const pool = new FixedPool(2, workerFile, {
      workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
    })
    try {
      await bounded(once(pool.emitter, PoolEvents.ready))
      await bounded(
        pool.addTaskFunction('first', {
          taskFunction: identify,
          workerNodeKeys: [0],
        })
      )
      await bounded(
        pool.addTaskFunction('second', {
          taskFunction: identify,
          workerNodeKeys: [1],
        })
      )
      await bounded(
        pool.addTaskFunction('select', function (name) {
          return this.setDefaultTaskFunction(name).status
        })
      )
      await bounded(pool.setDefaultTaskFunction('first'))
      expect(await bounded(pool.execute({ before: true }))).toEqual({
        before: true,
        workerId: pool.workerNodes[0].info.id,
      })
      for (let i = 0; i < 2; ++i) {
        expect(await bounded(pool.execute('second', 'select'))).toBe(true)
      }
      expect(await bounded(pool.execute({ after: true }))).toEqual({
        after: true,
        workerId: pool.workerNodes[1].info.id,
      })
    } finally {
      await bounded(pool.destroy())
    }
  })

  it.each(['add', 'remove', 'default'])(
    'restores the full state before completing a corrective %s',
    async operation => {
      const pool = new FixedPool(1, workerFile)
      const errors = []
      pool.emitter.on(PoolEvents.error, error => errors.push(error))
      let node
      const pending = []
      try {
        await bounded(once(pool.emitter, PoolEvents.ready))
        await bounded(pool.addTaskFunction('runtime', () => 'runtime'))
        await bounded(
          pool.addTaskFunction('later', {
            priority: -10,
            strategy: WorkerChoiceStrategies.FAIR_SHARE,
            taskFunction: () => 'later',
          })
        )
        await bounded(pool.setDefaultTaskFunction('later'))
        await bounded(pool.destroy())
        const send = pool.sendToWorker.bind(pool)
        let injected = false
        pool.sendToWorker = (key, message) => {
          if (
            !injected &&
            message.taskFunctionOperation === 'add' &&
            message.taskFunctionProperties.name === 'later'
          ) {
            injected = true
            message = {
              ...message,
              taskFunctionProperties: {
                ...message.taskFunctionProperties,
                priority: 1000,
              },
            }
          }
          send(key, message)
        }
        const failed = once(pool.emitter, PoolEvents.error)
        pool.start()
        node = pool.workerNodes[0]
        await bounded(failed)
        await control(node, {
          control: 'hold',
          name: 'later',
          operation: 'add',
        })
        const held = waitForMessage(
          node.worker,
          message => message.heldOperation === 'add'
        )
        let corrected = false
        const correction = outcome(
          operation === 'add'
            ? pool.addTaskFunction('runtime', () => 'updated')
            : operation === 'remove'
              ? pool.removeTaskFunction('runtime')
              : pool.setDefaultTaskFunction('runtime')
        ).then(result => {
          corrected = true
          return result
        })
        let queuedDone = false
        const queued = outcome(
          pool.addTaskFunction('queued', () => 'queued')
        ).then(result => {
          queuedDone = true
          return result
        })
        pending.push(correction, queued)
        await bounded(held)
        expect(node.info.ready).toBe(false)
        expect(corrected).toBe(false)
        expect(queuedDone).toBe(false)
        await control(node, { control: 'release' })
        expect(await bounded(correction)).toEqual({ value: true })
        expect(await bounded(queued)).toEqual({ value: true })
        expect(pool.workerNodes[0]).toBe(node)
        expect(node.info.ready).toBe(true)
        expect(await bounded(pool.execute({}, 'later'))).toBe('later')
        expect(await bounded(pool.execute({}))).toBe(
          operation === 'default' ? 'runtime' : 'later'
        )
        expect(await bounded(pool.execute({}, 'queued'))).toBe('queued')
        if (operation === 'remove') {
          await expect(bounded(pool.execute({}, 'runtime'))).rejects.toThrow(
            "Task function 'runtime' not found"
          )
        } else {
          expect(await bounded(pool.execute({}, 'runtime'))).toBe(
            operation === 'add' ? 'updated' : 'runtime'
          )
        }
        expect(pool.listTaskFunctionsProperties()).toContainEqual({
          name: 'later',
          priority: -10,
          strategy: WorkerChoiceStrategies.FAIR_SHARE,
        })
        expect(errors).toEqual([expect.any(Error)])
      } finally {
        if (node != null && pool.workerNodes.includes(node)) {
          await control(node, { control: 'release' })
        }
        await bounded(pool.destroy())
        await bounded(Promise.allSettled(pending))
      }
    }
  )

  it('keeps repeated replay failures recoverable without becoming ready early', async () => {
    const pool = new FixedPool(1, workerFile, { startWorkers: false })
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    try {
      const invalid = () => 'invalid'
      invalid.toString = () => 'null'
      await bounded(pool.addTaskFunction('first', invalid))
      await bounded(pool.addTaskFunction('second', invalid))
      await bounded(pool.addTaskFunction('later', () => 'later'))
      let failed = once(pool.emitter, PoolEvents.error)
      pool.start()
      const node = pool.workerNodes[0]
      await bounded(failed)
      failed = once(pool.emitter, PoolEvents.error)
      expect(await bounded(pool.addTaskFunction('first', () => 'first'))).toBe(
        true
      )
      await bounded(failed)
      expect(node.info.ready).toBe(false)
      expect(
        await bounded(pool.addTaskFunction('second', () => 'second'))
      ).toBe(true)
      expect(pool.workerNodes[0]).toBe(node)
      expect(node.info.ready).toBe(true)
      expect(await bounded(pool.execute({}, 'first'))).toBe('first')
      expect(await bounded(pool.execute({}, 'second'))).toBe('second')
      expect(await bounded(pool.execute({}, 'later'))).toBe('later')
      expect(errors).toEqual([expect.any(Error), expect.any(Error)])
    } finally {
      await bounded(pool.destroy())
    }
  })

  it.each(['exit', 'destroy'])(
    'settles corrective registration when %s interrupts recovery',
    async transition => {
      const pool = new FixedPool(1, workerFile, { startWorkers: false })
      const errors = []
      pool.emitter.on(PoolEvents.error, error => errors.push(error))
      let node
      let correction
      try {
        const invalid = () => 'invalid'
        invalid.toString = () => 'null'
        await bounded(pool.addTaskFunction('runtime', invalid))
        await bounded(pool.addTaskFunction('later', () => 'later'))
        const failed = once(pool.emitter, PoolEvents.error)
        pool.start()
        node = pool.workerNodes[0]
        await bounded(failed)
        await control(node, {
          control: 'hold',
          name: 'later',
          operation: 'add',
        })
        const held = waitForMessage(
          node.worker,
          message => message.heldOperation === 'add'
        )
        correction = outcome(pool.addTaskFunction('runtime', () => 'corrected'))
        await bounded(held)
        expect(node.info.ready).toBe(false)
        if (transition === 'exit') await bounded(node.terminate())
        else await bounded(pool.destroy())
        expect(await bounded(correction)).toEqual({ value: true })
        if (transition === 'exit') {
          expect(pool.workerNodes[0]).not.toBe(node)
          expect(await bounded(pool.execute({}, 'runtime'))).toBe('corrected')
          expect(await bounded(pool.execute({}, 'later'))).toBe('later')
        } else {
          expect(pool.info.started).toBe(false)
          expect(pool.workerNodes).toEqual([])
        }
        expect(errors).toEqual([expect.any(Error)])
      } finally {
        if (node != null && pool.workerNodes.includes(node)) {
          await control(node, { control: 'release' })
        }
        if (pool.info.started) await bounded(pool.destroy())
        await bounded(Promise.allSettled([correction]))
      }
    }
  )

  it('keeps a failed bootstrap unavailable when native readiness arrives later', async () => {
    const pool = new FixedPool(1, workerFile, { startWorkers: false })
    const errors = []
    pool.emitter.on(PoolEvents.error, error => errors.push(error))
    try {
      await bounded(pool.addTaskFunction('runtime', () => 'runtime'))
      const send = pool.sendToWorker.bind(pool)
      let injected = false
      pool.sendToWorker = (key, message) => {
        if (!injected && message.taskFunctionOperation === 'add') {
          injected = true
          throw new Error(
            'Injected replay send failure before native readiness'
          )
        }
        send(key, message)
      }
      const failed = once(pool.emitter, PoolEvents.error)
      pool.start()
      const node = pool.workerNodes[0]
      const nativeReady = waitForMessage(
        node.messageChannel?.port1 ?? node.worker,
        message => message.ready === true
      )
      await bounded(failed)
      await bounded(nativeReady)
      expect(node.info.ready).toBe(false)
      expect(
        await bounded(pool.addTaskFunction('runtime', () => 'corrected'))
      ).toBe(true)
      expect(pool.workerNodes[0]).toBe(node)
      expect(node.info.ready).toBe(true)
      expect(await bounded(pool.execute({}, 'runtime'))).toBe('corrected')
      expect(errors).toEqual([expect.any(Error)])
    } finally {
      await bounded(pool.destroy())
    }
  })
})
