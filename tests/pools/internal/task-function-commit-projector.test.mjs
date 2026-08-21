import { describe, expect, it } from 'vitest'

import { TaskFunctionCommitProjector } from '../../../lib/pools/task-function-commit-projector.mjs'

const snapshot = (revision, names) =>
  Object.freeze({
    defaultName: '__default__',
    entries: Object.freeze(names.map(name => Object.freeze({ name }))),
    revision,
  })

describe('TaskFunctionCommitProjector', () => {
  it('attempts deterministic projections after each earlier projection failure', () => {
    const calls = []
    const errors = []
    const failures = {
      remove: new Error('remove failed'),
      statistics: new Error('statistics failed'),
      strategies: new Error('strategies failed'),
    }
    const projector = new TaskFunctionCommitProjector({
      projectRemovedUsage: (name, workerNodeKey) => {
        calls.push(`remove:${name}:${workerNodeKey}`)
        if (workerNodeKey === 0) throw failures.remove
      },
      report: (error, committed) => {
        errors.push({ error, revision: committed.revision })
      },
      sendStatistics: workerNodeKey => {
        calls.push(`statistics:${workerNodeKey}`)
        if (workerNodeKey === 0) throw failures.statistics
      },
      synchronizeStrategies: () => {
        calls.push('strategies')
        throw failures.strategies
      },
      workerNodeKeys: () => [0, 1],
    })

    projector.project(snapshot(2, ['kept']), snapshot(1, ['removed', 'kept']))

    expect(calls).toStrictEqual([
      'remove:removed:0',
      'remove:removed:1',
      'strategies',
      'statistics:0',
      'statistics:1',
    ])
    expect(errors).toStrictEqual([
      { error: failures.remove, revision: 2 },
      { error: failures.strategies, revision: 2 },
      { error: failures.statistics, revision: 2 },
    ])
  })

  it('defers a reporting failure once and continues later projections', () => {
    const calls = []
    const deferred = []
    const reported = []
    const projectionError = new Error('projection failed')
    const reportingError = new Error('reporting failed')
    const projector = new TaskFunctionCommitProjector({
      defer: error => deferred.push(error),
      projectRemovedUsage: (_name, workerNodeKey) => {
        calls.push(`remove:${workerNodeKey}`)
        throw projectionError
      },
      report: error => {
        reported.push(error)
        throw reportingError
      },
      sendStatistics: workerNodeKey => {
        calls.push(`statistics:${workerNodeKey}`)
      },
      synchronizeStrategies: () => {
        calls.push('strategies')
      },
      workerNodeKeys: () => [0],
    })

    projector.project(snapshot(2, []), snapshot(1, ['removed']))

    expect(reported).toStrictEqual([projectionError])
    expect(calls).toStrictEqual(['remove:0', 'strategies', 'statistics:0'])
    expect(deferred).toStrictEqual([reportingError])
  })
})
