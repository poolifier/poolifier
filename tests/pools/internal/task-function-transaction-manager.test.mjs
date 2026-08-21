import { afterEach, describe, expect, it, vi } from 'vitest'

import { WorkerTerminationError } from '../../../lib/index.mjs'
import { TaskFunctionTransactionError } from '../../../lib/pools/task-function-transaction-types.mjs'
import { DEFAULT_TASK_NAME } from '../../../lib/utils.mjs'
import {
  createTransactionFixture,
  taskFunction,
} from './task-function-transaction-fixture.mjs'

afterEach(() => {
  vi.useRealTimers()
})

describe('TaskFunctionTransactionManager', () => {
  it('invokes idle admission synchronously before returning', () => {
    const fixture = createTransactionFixture()
    const admit = vi.fn(snapshot => snapshot.revision)

    const admitted = fixture.manager.withStableCatalogAdmission(admit)

    expect(admit).toHaveBeenCalledOnce()
    expect(admitted).toBe(0)
  })

  it.each(['add', 'replace', 'remove', 'default'])(
    'commits a successful %s transaction exactly once',
    async operation => {
      const fixture = createTransactionFixture()
      await fixture.manager.add('one', taskFunction('one'))
      const before = fixture.manager.snapshot.revision

      if (operation === 'add') {
        await fixture.manager.add('two', taskFunction('two'))
      }
      if (operation === 'replace') {
        await fixture.manager.add('one', taskFunction('replacement'))
      }
      if (operation === 'remove') await fixture.manager.remove('one')
      if (operation === 'default') await fixture.manager.setDefault('one')

      expect(fixture.manager.snapshot.revision).toBe(before + 1)
      expect(fixture.commits).toHaveLength(before + 1)
    }
  )

  it('keeps a committed mutation successful when its post-commit callback throws', async () => {
    const thrown = { source: 'projection' }
    const postCommitErrors = []
    const fixture = createTransactionFixture({
      onCommit: () => {
        throw thrown
      },
      onPostCommitError: (error, snapshot) => {
        postCommitErrors.push({ error, snapshot })
      },
    })

    const mutation = fixture.manager.add('one', taskFunction('one'))

    await expect(mutation).resolves.toBe(true)
    expect(fixture.manager.snapshot).toMatchObject({ revision: 1 })
    expect(postCommitErrors).toStrictEqual([
      { error: thrown, snapshot: fixture.manager.snapshot },
    ])
    expect(fixture.sent.map(message => message.operation)).toStrictEqual([
      'add',
      'add',
    ])
    expect(fixture.quarantined).toStrictEqual([])
  })

  it('defers a post-commit reporting failure once after commit', async () => {
    const observed = []
    const projectionError = new Error('projection failed')
    const reportingError = new Error('reporting failed')
    const fixture = createTransactionFixture({
      onCommit: () => {
        throw projectionError
      },
      onPostCommitError: error => {
        observed.push(error)
        throw reportingError
      },
    })

    await expect(fixture.manager.add('one', taskFunction('one'))).resolves.toBe(
      true
    )
    expect(fixture.manager.snapshot.revision).toBe(1)
    expect(observed).toStrictEqual([projectionError])
    expect(fixture.quarantined).toStrictEqual([])
    expect(fixture.sent.map(message => message.operation)).toStrictEqual([
      'add',
      'add',
    ])
    expect(fixture.deferredErrors).toStrictEqual([reportingError])
  })

  it('serializes mutations in invocation order and admits dispatch after commit', async () => {
    const fixture = createTransactionFixture({ automatic: false })
    const first = fixture.manager.add('one', taskFunction('one'))
    const admitted = fixture.manager.withStableCatalogAdmission(
      snapshot => snapshot.revision
    )
    const second = fixture.manager.add('two', taskFunction('two'))
    await fixture.sentCount(2)
    expect(fixture.sent.map(message => message.name)).toStrictEqual([
      'one',
      'one',
    ])

    fixture.ackAll()
    await first
    await fixture.sentCount(4)
    fixture.ackAll()

    await expect(second).resolves.toBe(true)
    await expect(admitted).resolves.toBe(2)
  })

  it('does not invoke admission when aborted while waiting for a mutation', async () => {
    const fixture = createTransactionFixture({ automatic: false })
    const mutation = fixture.manager.add('one', taskFunction('one'))
    await fixture.sentCount(2)
    const controller = new AbortController()
    const admit = vi.fn()
    const admission = fixture.manager.withStableCatalogAdmission(
      admit,
      controller.signal
    )

    controller.abort(new Error('task aborted'))
    fixture.ackAll()

    await mutation
    await expect(admission).rejects.toThrow('task aborted')
    expect(admit).not.toHaveBeenCalled()
  })

  it('releases admission after a rejected mutation', async () => {
    const fixture = createTransactionFixture({ automatic: false })
    const mutation = fixture.manager.add('one', taskFunction('one'))
    await fixture.sentCount(2)
    fixture.nack(1)
    fixture.nack(2)
    const admit = vi.fn(snapshot => snapshot.revision)
    const admission = fixture.manager.withStableCatalogAdmission(admit)

    await expect(mutation).rejects.toBeInstanceOf(TaskFunctionTransactionError)
    await expect(admission).resolves.toBe(0)
    expect(admit).toHaveBeenCalledOnce()

    const idleAdmission = fixture.manager.withStableCatalogAdmission(admit)
    expect(idleAdmission).toBe(0)
    expect(admit).toHaveBeenCalledTimes(2)
  })

  it('correlates reverse responses and compensates acknowledged workers on NACK', async () => {
    const fixture = createTransactionFixture({ automatic: false })
    const operation = fixture.manager.add('one', taskFunction('one'))
    await fixture.sentCount(2)
    fixture.ack(1)
    fixture.nack(2)

    await expect(operation).rejects.toBeInstanceOf(TaskFunctionTransactionError)
    expect(
      fixture.sent.map(message => [message.workerId, message.operation])
    ).toStrictEqual([
      [1, 'add'],
      [2, 'add'],
      [1, 'remove'],
    ])
    expect(fixture.manager.snapshot.revision).toBe(0)
    expect(fixture.quarantined).toStrictEqual([])
  })

  it('preserves typed worker termination when compensation admission rejects', async () => {
    vi.useFakeTimers()
    const fixture = createTransactionFixture({
      automatic: false,
      compensationAutomatic: false,
    })
    const operation = fixture.manager.add('one', taskFunction('one'))
    await fixture.sentCount(2)
    fixture.ack(1)
    fixture.nack(2)
    await fixture.sentCount(3)
    const terminationError = new WorkerTerminationError(
      'Worker termination closed task function admission',
      { workerId: fixture.handles[0].lease.id }
    )

    fixture.crash(1, terminationError)
    const failure = await operation.catch(error => error)
    const compensationFailure = failure.failures.find(
      item => item.phase === 'compensation'
    )

    expect(failure).toBeInstanceOf(TaskFunctionTransactionError)
    expect(failure.operationId).toBe('operation-1')
    expect(compensationFailure).toStrictEqual({
      cause: terminationError,
      lease: fixture.handles[0].lease,
      phase: 'compensation',
    })
    expect(fixture.manager.snapshot.revision).toBe(0)
    expect(fixture.commits).toStrictEqual([])
    expect(
      fixture.sent.map(message => [message.workerId, message.operation])
    ).toStrictEqual([
      [1, 'add'],
      [2, 'add'],
      [1, 'remove'],
    ])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('compensates the first default mutation with the concrete static default', async () => {
    const fixture = createTransactionFixture({
      automatic: false,
      staticDefaultName: 'execute',
      staticNames: ['execute', 'factorial'],
    })
    await fixture.initialization
    const before = fixture.manager.snapshot
    const operation = fixture.manager.setDefault('factorial')
    await fixture.sentCount(2)
    fixture.ack(1)
    fixture.nack(2)

    await expect(operation).rejects.toBeInstanceOf(TaskFunctionTransactionError)

    expect(fixture.sent.at(-1)).toMatchObject({
      name: 'execute',
      operation: 'default',
      workerId: 1,
    })
    expect(fixture.manager.snapshot).toStrictEqual(before)
    expect(fixture.quarantined).toStrictEqual([])
  })

  it('restores the concrete static default on the healthy worker after a peer crash', async () => {
    const fixture = createTransactionFixture({
      automatic: false,
      staticDefaultName: 'execute',
      staticNames: ['execute', 'factorial'],
    })
    await fixture.initialization
    const before = fixture.manager.snapshot
    const operation = fixture.manager.setDefault('factorial')
    await fixture.sentCount(2)
    fixture.ack(1)
    await Promise.resolve()
    fixture.crash(2, new Error('worker crashed'))

    await expect(operation).rejects.toBeInstanceOf(TaskFunctionTransactionError)

    expect(fixture.sent.at(-1)).toMatchObject({
      name: 'execute',
      operation: 'default',
      workerId: 1,
    })
    expect(fixture.manager.snapshot).toStrictEqual(before)
    expect(fixture.quarantined.map(item => item.handle.lease.id)).toStrictEqual(
      [2]
    )
  })

  it('rejects default mutation until a canonical static default is known', async () => {
    const fixture = createTransactionFixture({
      staticDefaultName: null,
      staticNames: ['execute', 'factorial'],
      workers: 0,
    })

    await expect(
      fixture.manager.setDefault('factorial')
    ).rejects.toBeInstanceOf(TaskFunctionTransactionError)

    expect(fixture.manager.snapshot).toMatchObject({
      defaultName: DEFAULT_TASK_NAME,
      revision: 0,
    })
  })

  it('aborts on topology change, compensates ACKs, and quarantines uncertain leases', async () => {
    const fixture = createTransactionFixture({ automatic: false })
    const operation = fixture.manager.add('one', taskFunction('one'))
    await fixture.sentCount(2)
    fixture.ack(2)
    fixture.changeTopology()

    const failure = await operation.catch(error => error)

    expect(failure).toBeInstanceOf(TaskFunctionTransactionError)
    expect(failure.operationId).toBe('operation-1')
    expect(failure.failures).toMatchObject([
      {
        cause: expect.objectContaining({
          message: 'Worker topology changed during task function transaction',
        }),
        lease: fixture.handles[0].lease,
        phase: 'topology',
      },
    ])
    expect(fixture.quarantined.map(item => item.handle.lease.id)).toContain(1)
    expect(fixture.sent.at(-1)).toMatchObject({
      operation: 'remove',
      workerId: 2,
    })
    expect(fixture.listenerCount()).toBe(0)
  })

  it('rejects when topology changes after all forward outcomes settle but before commit', async () => {
    const fixture = createTransactionFixture({ automatic: false })
    const operation = fixture.manager.add('one', taskFunction('one'))
    await fixture.sentCount(2)

    fixture.ackAll()
    fixture.changeTopologyWithoutNotification()

    const error = await operation.catch(error => error)

    expect(error).toBeInstanceOf(TaskFunctionTransactionError)
    expect(error.failures).toHaveLength(1)
    expect(error.failures[0].phase).toBe('topology')
    expect(error.failures[0].cause).toBeInstanceOf(Error)
    expect(error.failures[0].cause.message).toBe(
      'Worker topology changed during task function transaction'
    )
    expect(error.cause).toBe(error.failures[0].cause)
    expect(fixture.manager.snapshot.revision).toBe(0)
    expect(
      fixture.sent.slice(2).map(message => message.operation)
    ).toStrictEqual(['remove', 'remove'])
  })

  it('quarantines a crashed lease and any peer with an uncertain forward result', async () => {
    const fixture = createTransactionFixture({ automatic: false })
    const operation = fixture.manager.add('one', taskFunction('one'))
    await fixture.sentCount(2)

    fixture.crash(1, new Error('worker crashed'))

    await expect(operation).rejects.toBeInstanceOf(TaskFunctionTransactionError)
    expect(fixture.quarantined.map(item => item.handle.lease.id)).toStrictEqual(
      [1, 2]
    )
    expect(fixture.listenerCount()).toBe(0)
  })

  it('excludes uncertain workers before compensation and reconciles only after lane settlement', async () => {
    const fixture = createTransactionFixture({
      automatic: false,
      compensationAutomatic: false,
    })
    const operation = fixture.manager.add('one', taskFunction('one'))
    await fixture.sentCount(2)
    fixture.ack(1)
    fixture.crash(2, new Error('worker crashed'))

    await fixture.sentCount(3)
    expect(fixture.excluded.map(handle => handle.lease.id)).toStrictEqual([2])
    expect(fixture.reconciled).toStrictEqual([])

    fixture.ack(1)
    await expect(operation).rejects.toBeInstanceOf(TaskFunctionTransactionError)
    await Promise.all(fixture.reconcileAdmissions)
    expect(fixture.reconciled.map(handle => handle.lease.id)).toStrictEqual([2])
    await expect(
      Promise.all(fixture.reconcileAdmissions)
    ).resolves.toStrictEqual([0])
  })

  it('uses separate thirty-second forward and compensation timeouts', async () => {
    vi.useFakeTimers()
    const fixture = createTransactionFixture({
      automatic: false,
      compensationAutomatic: false,
    })
    const operation = fixture.manager.add('one', taskFunction('one'))
    await vi.advanceTimersByTimeAsync(0)
    fixture.ack(1)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(fixture.sent.at(-1)).toMatchObject({
      operation: 'remove',
      workerId: 1,
    })
    await vi.advanceTimersByTimeAsync(30_000)

    await expect(operation).rejects.toBeInstanceOf(TaskFunctionTransactionError)
    expect(fixture.quarantined.map(item => item.handle.lease.id)).toStrictEqual(
      [2, 1]
    )
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    ['ACK', fixture => fixture.ackAll()],
    [
      'NACK',
      fixture => {
        fixture.ack(1)
        fixture.nack(2)
      },
    ],
  ])(
    'removes the forward timeout immediately after an early %s outcome',
    async (_, settle) => {
      vi.useFakeTimers()
      const fixture = createTransactionFixture({ automatic: false })
      const operation = fixture.manager.add('one', taskFunction('one'))
      await vi.advanceTimersByTimeAsync(0)

      settle(fixture)
      await vi.advanceTimersByTimeAsync(0)
      await operation.catch(() => undefined)

      expect(vi.getTimerCount()).toBe(0)
      await vi.advanceTimersByTimeAsync(30_000)
      expect(vi.getTimerCount()).toBe(0)
    }
  )

  it('rejects removing the only implementation of the logical default', async () => {
    const fixture = createTransactionFixture({ workers: 0 })
    await fixture.manager.add('one', taskFunction('one'))
    await fixture.manager.setDefault('one')
    await expect(fixture.manager.remove('one')).rejects.toBeInstanceOf(
      TaskFunctionTransactionError
    )

    expect(fixture.manager.snapshot).toMatchObject({
      defaultName: 'one',
      revision: 2,
    })
    await expect(
      fixture.manager.setDefault('worker-file-only')
    ).rejects.toBeInstanceOf(TaskFunctionTransactionError)
  })

  it('keeps the logical default when removing an overlay backed by static code', async () => {
    const fixture = createTransactionFixture({
      staticNames: ['one'],
      workers: 0,
    })
    await fixture.manager.add('one', taskFunction('overlay'))
    await fixture.manager.setDefault('one')

    await expect(fixture.manager.remove('one')).resolves.toBe(true)

    expect(fixture.manager.snapshot).toMatchObject({
      defaultName: 'one',
      entries: [],
      revision: 3,
    })
  })

  it('does not expose mutable catalog state', async () => {
    const fixture = createTransactionFixture({ workers: 0 })
    await fixture.manager.add('one', taskFunction('one'))
    const snapshot = fixture.manager.snapshot

    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.entries)).toBe(true)
    expect(Object.isFrozen(snapshot.entries[0])).toBe(true)
    expect(() => snapshot.entries.push({ name: 'two' })).toThrow()
    expect(
      fixture.manager.snapshot.entries.map(entry => entry.name)
    ).toStrictEqual(['one'])
  })

  it('restores the exact previous function and default during compensation', async () => {
    const fixture = createTransactionFixture()
    const original = taskFunction('original')
    await fixture.manager.add('one', original)
    await fixture.manager.setDefault('one')
    fixture.automatic = false

    const sentBeforeReplace = fixture.sent.length
    const replace = fixture.manager.add('one', taskFunction('replacement'))
    await fixture.sentCount(sentBeforeReplace + 2)
    fixture.ack(1)
    fixture.nack(2)
    await expect(replace).rejects.toBeInstanceOf(TaskFunctionTransactionError)
    expect(fixture.sent.at(-1)).toMatchObject({
      operation: 'add',
      taskFunction: original,
    })

    const sentBeforeDefault = fixture.sent.length
    const changeDefault = fixture.manager.setDefault('execute')
    await fixture.sentCount(sentBeforeDefault + 2)
    fixture.ack(1)
    fixture.nack(2)
    await expect(changeDefault).rejects.toBeInstanceOf(
      TaskFunctionTransactionError
    )
    expect(fixture.sent.at(-1)).toMatchObject({
      name: 'one',
      operation: 'default',
    })
  })

  it('replays entries in name order and the concrete default last', async () => {
    const fixture = createTransactionFixture({ workers: 1 })
    await fixture.manager.add('zeta', taskFunction('zeta'))
    await fixture.manager.add('alpha', taskFunction('alpha'))
    await fixture.manager.setDefault('zeta')
    fixture.sent.length = 0

    await fixture.manager.synchronize(fixture.handles[0])

    expect(
      fixture.sent.map(({ name, operation }) => [name, operation])
    ).toStrictEqual([
      ['alpha', 'add'],
      ['zeta', 'add'],
      ['zeta', 'default'],
    ])
  })

  it('sends no default command for the concrete static default', async () => {
    const fixture = createTransactionFixture({ workers: 1 })
    await fixture.manager.add('one', taskFunction('one'))
    fixture.sent.length = 0

    await fixture.manager.synchronize(fixture.handles[0])

    expect(fixture.sent.map(message => message.operation)).toStrictEqual([
      'add',
    ])
  })

  it('replays only the logical default after removing a static shadow overlay', async () => {
    const fixture = createTransactionFixture({
      staticDefaultName: 'execute',
      staticNames: ['execute', 'factorial'],
      workers: 1,
    })
    await fixture.manager.add('factorial', taskFunction('overlay'))
    await fixture.manager.setDefault('factorial')
    await fixture.manager.remove('factorial')
    fixture.sent.length = 0

    await fixture.manager.synchronize(fixture.handles[0])

    expect(
      fixture.sent.map(({ name, operation }) => [name, operation])
    ).toStrictEqual([['factorial', 'default']])
  })

  it('applies add, remove, and default deltas until the replay revision converges', async () => {
    const fixture = createTransactionFixture({ automatic: false, workers: 1 })
    fixture.automatic = true
    await fixture.manager.add('remove-me', taskFunction('remove-me'))
    await fixture.manager.add('keep', taskFunction('keep'))
    fixture.sent.length = 0
    fixture.automatic = false

    const replay = fixture.manager.synchronize(fixture.handles[0])
    await fixture.sentCount(1)
    fixture.ackAll()
    await fixture.sentCount(2)

    fixture.automatic = true
    await fixture.manager.remove('remove-me')
    await fixture.manager.add('added', taskFunction('added'))
    await fixture.manager.setDefault('added')
    const expectedRevision = fixture.manager.snapshot.revision
    fixture.automatic = false
    const replayDeltaStart = fixture.sent.length
    fixture.ack(1)

    await fixture.sentCount(replayDeltaStart + 1)
    expect(fixture.sent.slice(replayDeltaStart)).toContainEqual(
      expect.objectContaining({ name: 'remove-me', operation: 'remove' })
    )
    fixture.ack(1)
    await fixture.sentCount(replayDeltaStart + 2)
    expect(fixture.sent.slice(replayDeltaStart)).toContainEqual(
      expect.objectContaining({ name: 'added', operation: 'add' })
    )
    fixture.ack(1)
    await fixture.sentCount(replayDeltaStart + 3)
    expect(fixture.sent.at(-1)).toMatchObject({
      name: 'added',
      operation: 'default',
    })
    fixture.ack(1)

    await expect(replay).resolves.toBe(expectedRevision)
  })

  it('quarantines a worker when replay times out', async () => {
    vi.useFakeTimers()
    const fixture = createTransactionFixture({ automatic: true, workers: 1 })
    await fixture.manager.add('one', taskFunction('one'))
    fixture.automatic = false

    const replay = fixture.manager.synchronize(fixture.handles[0])
    const replayOutcome = replay.catch(error => error)
    await vi.advanceTimersByTimeAsync(30_000)

    await expect(replayOutcome).resolves.toBeInstanceOf(
      TaskFunctionTransactionError
    )
    expect(fixture.quarantined.map(item => item.handle.lease.id)).toStrictEqual(
      [1]
    )
    expect(vi.getTimerCount()).toBe(0)
  })
})
