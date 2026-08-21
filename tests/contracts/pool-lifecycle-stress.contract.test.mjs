import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const childPath = 'tests/pools/fixtures/pool-lifecycle-stress-child.mjs'
const iterations = 1
const metricFields = [
  'duplicateLifecycleEvents',
  'executing',
  'failures',
  'listenerDelta',
  'pendingTasks',
  'queued',
  'replacementsAfterClose',
  'unexpectedErrors',
  'workersStillLive',
]
const schemaFields = [...metricFields, 'iterations', 'transport'].sort()

for (const transport of ['thread', 'cluster']) {
  it(`[green][${transport}] stress child reports zero lifecycle failures and resources`, {
    retry: 0,
    timeout: 60_000,
  }, async () => {
    const { stderr, stdout } = await execFileAsync(
      process.execPath,
      [childPath, '--transport', transport, '--iterations', String(iterations)],
      { timeout: 55_000 }
    )
    const lines = stdout.trimEnd().split('\n')

    expect(stderr).toBe('')
    expect(lines).toHaveLength(1)
    const report = JSON.parse(lines[0])
    expect(Object.keys(report).sort()).toEqual(schemaFields)
    expect(report.transport).toBe(transport)
    expect(report.iterations).toBe(iterations)
    for (const field of metricFields) expect(report[field]).toBe(0)
  })

  it.each([
    ['zero iterations', ['--transport', transport, '--iterations', '0']],
    [
      'fractional iterations',
      ['--transport', transport, '--iterations', '1.5'],
    ],
    ['unknown transport', ['--transport', 'process', '--iterations', '1']],
    ['unknown option', ['--transport', transport, '--count', '1']],
    ['missing option', ['--transport', transport]],
    [
      'extra option',
      ['--transport', transport, '--iterations', '1', '--extra', 'x'],
    ],
  ])(
    `[green][${transport}] stress child rejects %s`,
    {
      retry: 0,
      timeout: 15_000,
    },
    async (_label, args) => {
      const outcome = await execFileAsync(
        process.execPath,
        [childPath, ...args],
        { timeout: 10_000 }
      ).then(
        value => ({ status: 'fulfilled', value }),
        reason => ({ reason, status: 'rejected' })
      )

      expect(outcome.status).toBe('rejected')
      expect(outcome.reason.code).not.toBe(0)
      expect(outcome.reason.stderr).toContain(
        'Usage: pool-lifecycle-stress-child.mjs'
      )
    }
  )
}
