import { describe, expect, it, vi } from 'vitest'

import { WorkerLifecycleCoordinator } from '../../../lib/pools/worker-lifecycle-coordinator.mjs'
import { register, worker } from './worker-lifecycle-fixture.mjs'

describe('Worker lifecycle failure ordering', () => {
  it.each([
    ['fixed', false],
    ['dynamic', true],
  ])(
    'captures the exact %s replacement failure and completes recovery',
    async (_kind, dynamic) => {
      const replacementFailure = { dynamic }
      const restore = vi.fn()
      const finalizeResidual = vi.fn()
      const drain = vi.fn()
      const replace = vi.fn(() => {
        throw replacementFailure
      })
      const coordinator = new WorkerLifecycleCoordinator({
        complete: vi.fn(),
        drain,
        exclude: vi.fn(),
        isPoolRunning: () => true,
        reconcile: () => ({
          finalizeResidual,
          prepare: vi.fn(),
          restore,
        }),
        remove: vi.fn(),
        replace,
        shouldReplace: () => true,
        snapshotOwnedWork: () => [],
        terminate: vi.fn(),
      })
      const handle = register(coordinator, worker(1, dynamic))

      const reconciliation = coordinator.fault(handle, new Error('crash'))
      const duplicate = coordinator.fault(handle, new Error('duplicate'))
      const error = await reconciliation.catch(value => value)

      expect(duplicate).toBe(reconciliation)
      expect(error.stage).toBe('replace')
      expect(error.cause).toBe(replacementFailure)
      expect(error.failures).toStrictEqual([
        { error: replacementFailure, stage: 'replace' },
      ])
      expect(restore).toHaveBeenCalledOnce()
      expect(drain).toHaveBeenCalledOnce()
      expect(finalizeResidual).toHaveBeenCalledOnce()
      expect(replace).toHaveBeenCalledOnce()
      expect(coordinator.state(handle)).toBe('removed')
    }
  )

  it.each([
    'exclude',
    'prepare',
    'remove',
    'terminate',
    'complete',
    'replace',
    'drain',
  ])('runs mandatory later phases when %s fails', async failedStage => {
    const calls = []
    const callbacks = Object.fromEntries(
      ['exclude', 'remove', 'terminate', 'complete', 'replace', 'drain'].map(
        stage => [
          stage,
          () => {
            calls.push(stage)
            if (stage === failedStage) throw new Error(stage)
            return ['complete', 'drain', 'replace', 'terminate'].includes(stage)
              ? Promise.resolve()
              : undefined
          },
        ]
      )
    )
    const coordinator = new WorkerLifecycleCoordinator({
      ...callbacks,
      isPoolRunning: () => true,
      reconcile: () => {
        calls.push('prepare')
        if (failedStage === 'prepare') throw new Error('prepare')
      },
      shouldReplace: () => true,
      snapshotOwnedWork: () => [],
    })
    const handle = register(coordinator, worker(1))

    await expect(
      coordinator.fault(handle, new Error('crash'))
    ).rejects.toMatchObject({
      stage: failedStage,
    })

    expect(calls).toStrictEqual([
      'exclude',
      'prepare',
      'remove',
      'terminate',
      'complete',
      'replace',
      'drain',
    ])
  })

  it('drains after isPoolRunning fails without evaluating replacement', async () => {
    const calls = []
    const failure = new Error('pool state failure')
    const coordinator = new WorkerLifecycleCoordinator({
      complete: async () => calls.push('complete'),
      drain: async () => calls.push('drain'),
      exclude: () => calls.push('exclude'),
      isPoolRunning: () => {
        calls.push('isPoolRunning')
        throw failure
      },
      reconcile: () => calls.push('prepare'),
      remove: () => calls.push('remove'),
      replace: async () => calls.push('replace'),
      shouldReplace: () => {
        calls.push('shouldReplace')
        return true
      },
      snapshotOwnedWork: () => [],
      terminate: async () => calls.push('terminate'),
    })
    const handle = register(coordinator, worker(1))

    const error = await coordinator
      .fault(handle, new Error('crash'))
      .catch(value => value)

    expect(error).toMatchObject({ cause: failure, stage: 'isPoolRunning' })
    expect(error.secondaryFailures).toStrictEqual([])
    expect(calls).toStrictEqual([
      'exclude',
      'prepare',
      'remove',
      'terminate',
      'complete',
      'isPoolRunning',
      'drain',
    ])
  })

  it('drains after shouldReplace fails without attempting replacement', async () => {
    const calls = []
    const failure = new Error('replacement policy failure')
    const drainFailure = new Error('drain after policy failure')
    const coordinator = new WorkerLifecycleCoordinator({
      complete: async () => calls.push('complete'),
      drain: async () => {
        calls.push('drain')
        throw drainFailure
      },
      exclude: () => calls.push('exclude'),
      isPoolRunning: () => {
        calls.push('isPoolRunning')
        return true
      },
      reconcile: () => calls.push('prepare'),
      remove: () => calls.push('remove'),
      replace: async () => calls.push('replace'),
      shouldReplace: () => {
        calls.push('shouldReplace')
        throw failure
      },
      snapshotOwnedWork: () => [],
      terminate: async () => calls.push('terminate'),
    })
    const handle = register(coordinator, worker(1))

    const error = await coordinator
      .fault(handle, new Error('crash'))
      .catch(value => value)

    expect(error).toMatchObject({ cause: failure, stage: 'shouldReplace' })
    expect(error.secondaryFailures).toStrictEqual([
      { error: drainFailure, stage: 'drain' },
    ])
    expect(calls).toStrictEqual([
      'exclude',
      'prepare',
      'remove',
      'terminate',
      'complete',
      'isPoolRunning',
      'shouldReplace',
      'drain',
    ])
  })

  it('keeps the first phase failure and orders secondary failures', async () => {
    const excludeFailure = new Error('exclude')
    const completeFailure = new Error('complete')
    const drainFailure = new Error('drain')
    const coordinator = new WorkerLifecycleCoordinator({
      complete: async () => {
        throw completeFailure
      },
      drain: async () => {
        throw drainFailure
      },
      exclude: () => {
        throw excludeFailure
      },
      isPoolRunning: () => true,
      reconcile: () => undefined,
      remove: () => undefined,
      replace: async () => undefined,
      shouldReplace: () => true,
      snapshotOwnedWork: () => [],
      terminate: async () => undefined,
    })
    const handle = register(coordinator, worker(1))

    const error = await coordinator
      .fault(handle, new Error('crash'))
      .catch(value => value)

    expect(error.stage).toBe('exclude')
    expect(error.cause).toBe(excludeFailure)
    expect(error.secondaryFailures).toStrictEqual([
      { error: completeFailure, stage: 'complete' },
      { error: drainFailure, stage: 'drain' },
    ])
  })
})
