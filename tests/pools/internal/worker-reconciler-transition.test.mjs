import { describe, expect, it, vi } from 'vitest'

import { WorkerReconciler } from '../../../lib/pools/worker-reconciler.mjs'

describe('WorkerReconciler dynamic transition', () => {
  it('uses the post-terminate transition for completion replacement and result', async () => {
    const order = ['fixture']
    const handle = {
      lease: { generation: 1, id: 7 },
      worker: { info: { dynamic: false, id: 7 } },
    }
    const terminationCause = new Error('pool termination')
    const crash = new Error('worker crash')
    const baseTransition = {
      cause: terminationCause,
      classification: 'draining',
      handle,
      ownedTaskIds: ['task'],
      previousState: 'ready',
    }
    const promotedTransition = {
      cause: crash,
      classification: 'faulted',
      exit: { code: 9, signal: 'SIGKILL' },
      handle,
      ownedTaskIds: ['task'],
      previousState: 'ready',
    }
    let transition = baseTransition
    const recovery = {
      finalizeResidual: vi.fn(() => order.push('finalizeResidual')),
      prepare: vi.fn(() => {
        order.push('prepare')
        return 'draining-value'
      }),
      restore: vi.fn(() => order.push('restore')),
    }
    const callbacks = {
      complete: vi.fn(() => order.push('complete')),
      drain: vi.fn(() => order.push('drain')),
      exclude: vi.fn(() => order.push('exclude')),
      isPoolRunning: vi.fn(() => {
        order.push('isPoolRunning')
        return true
      }),
      reconcile: vi.fn(() => {
        order.push('reconcile')
        return recovery
      }),
      remove: vi.fn(() => order.push('remove')),
      replace: vi.fn(() => order.push('replace')),
      shouldReplace: vi.fn(() => {
        order.push('shouldReplace')
        return true
      }),
      snapshotOwnedWork: vi.fn(() => []),
      terminate: vi.fn(() => {
        order.push('terminate')
        transition = promotedTransition
      }),
    }
    const finalize = vi.fn(() => order.push('finalize'))

    const result = await new WorkerReconciler(callbacks).reconcile({
      baseTransition,
      command: {
        allowReplacement: true,
        cause: terminationCause,
        classification: 'draining',
        handle,
      },
      finalize,
      transition: () => transition,
    })

    expect(callbacks.reconcile).toHaveBeenCalledExactlyOnceWith(
      baseTransition,
      expect.any(AbortSignal)
    )
    expect(callbacks.terminate).toHaveBeenCalledExactlyOnceWith(
      baseTransition,
      expect.any(AbortSignal)
    )
    expect(callbacks.complete).toHaveBeenCalledExactlyOnceWith(
      {
        reconciliationValue: 'draining-value',
        transition: promotedTransition,
      },
      expect.any(AbortSignal)
    )
    const replacement = { classification: 'faulted', handle }
    expect(callbacks.shouldReplace).toHaveBeenCalledExactlyOnceWith(
      replacement,
      expect.any(AbortSignal)
    )
    expect(callbacks.replace).toHaveBeenCalledExactlyOnceWith(
      replacement,
      expect.any(AbortSignal)
    )
    expect(result).toStrictEqual({
      cause: crash,
      classification: 'faulted',
      committed: true,
      exit: promotedTransition.exit,
      lease: handle.lease,
    })
    expect(order).toStrictEqual([
      'fixture',
      'exclude',
      'reconcile',
      'prepare',
      'remove',
      'terminate',
      'complete',
      'isPoolRunning',
      'shouldReplace',
      'replace',
      'restore',
      'drain',
      'finalizeResidual',
      'finalize',
    ])
    for (const phase of [
      callbacks.exclude,
      callbacks.reconcile,
      recovery.prepare,
      callbacks.remove,
      callbacks.terminate,
      callbacks.complete,
      callbacks.isPoolRunning,
      callbacks.shouldReplace,
      callbacks.replace,
      recovery.restore,
      callbacks.drain,
      recovery.finalizeResidual,
      finalize,
    ]) {
      expect(phase).toHaveBeenCalledOnce()
    }
  })
})
