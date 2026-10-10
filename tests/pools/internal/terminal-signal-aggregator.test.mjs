import { describe, expect, it, vi } from 'vitest'

import { TerminalSignalAggregator } from '../../../lib/pools/terminal-signal-aggregator.mjs'

const createFixture = () => {
  const drain = Promise.withResolvers()
  const reconciliations = []
  const quarantines = []
  const aggregator = new TerminalSignalAggregator({
    quarantine: observation => quarantines.push(observation),
    reconcile: async observation => {
      reconciliations.push(observation)
      return {
        ...observation,
        committed: true,
        lease: { generation: 1, id: 1 },
      }
    },
    waitForTransportDrain: () => drain.promise,
  })
  return { aggregator, drain, quarantines, reconciliations }
}

describe('TerminalSignalAggregator', () => {
  it('allows a response between exit and drain to settle before reconciliation', async () => {
    const { aggregator, drain, reconciliations } = createFixture()
    const response = vi.fn()

    const terminal = aggregator.exit({ code: 1 }, true, new Error('exit'))
    response()
    expect(reconciliations).toStrictEqual([])
    drain.resolve()
    await terminal

    expect(response).toHaveBeenCalledOnce()
    expect(reconciliations).toHaveLength(1)
  })

  it('reconciles an exit without a response after drain', async () => {
    const { aggregator, drain, reconciliations } = createFixture()

    const terminal = aggregator.exit({ code: 1 }, true, new Error('exit'))
    drain.resolve()
    await terminal

    expect(reconciliations).toHaveLength(1)
  })

  it('preserves a response observed before exit and drain', async () => {
    const { aggregator, drain, reconciliations } = createFixture()
    const response = vi.fn()

    response()
    const terminal = aggregator.exit({ code: 0 }, false, new Error('clean'))
    drain.resolve()
    await terminal

    expect(response).toHaveBeenCalledOnce()
    expect(reconciliations[0].classification).toBe('exited')
  })

  it('deduplicates error exit and drain into one reconciliation', async () => {
    const { aggregator, drain, reconciliations } = createFixture()
    const error = new Error('first')

    const first = aggregator.error(error)
    const duplicate = aggregator.exit({ code: 1 }, true, new Error('exit'))
    drain.resolve()
    const [firstResult, duplicateResult] = await Promise.all([first, duplicate])

    expect(firstResult).toBe(duplicateResult)
    expect(reconciliations).toHaveLength(1)
    expect(reconciliations[0]).toMatchObject({
      cause: error,
      exit: { code: 1 },
    })
  })

  it('ignores terminal signals after drain reconciliation', async () => {
    const { aggregator, drain, reconciliations } = createFixture()

    const terminal = aggregator.exit({ code: 0 }, false, new Error('clean'))
    drain.resolve()
    await terminal
    await aggregator.error(new Error('stale'))

    expect(reconciliations).toHaveLength(1)
  })
})
