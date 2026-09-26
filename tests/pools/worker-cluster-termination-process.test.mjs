import { spawnSync } from 'node:child_process'
import { expect, it } from 'vitest'

const fixturePath = 'tests/pools/fixtures/cluster-worker-termination-child.mjs'

const isPidAlive = pid => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}

it.skipIf(process.platform === 'win32')(
  'confirms a resistant cluster worker exits by SIGKILL before termination settles',
  { retry: 0, timeout: 15_000 },
  () => {
    // Given a local child process that ignores SIGTERM
    const child = spawnSync(process.execPath, [fixturePath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      killSignal: 'SIGKILL',
      timeout: 15_000,
    })
    const records = []

    try {
      for (const line of child.stdout.trim().split('\n')) {
        if (line.length > 0) records.push(JSON.parse(line))
      }
      const ready = records.find(record => record.marker === 'ready')
      const exit = records.find(record => record.marker === 'exit')
      const settled = records.find(record => record.marker === 'settled')
      const report = records.find(record => record.marker === 'report')

      // When the termination protocol runs to completion
      expect(child.error).toBeUndefined()
      expect(child.signal).toBeNull()
      expect(child.status).toBe(0)
      expect(child.stderr).toBe('')

      // Then SIGKILL exit is observed before settlement without fallback cleanup
      expect(ready.pid).toBe(report.pid)
      expect(exit).toMatchObject({
        code: null,
        signal: 'SIGKILL',
      })
      expect(settled).toMatchObject({
        status: 'fulfilled',
      })
      expect(report).toMatchObject({
        exitCode: null,
        exitSignal: 'SIGKILL',
      })
      expect(isPidAlive(report.pid)).toBe(false)
      expect({
        cleanupForced: report.cleanupForced,
        exitBeforeSettlement: report.exitBeforeSettlement,
        exitObservedAtSettlement: settled.exitObserved,
        terminationSettledAtExit: exit.terminationSettled,
      }).toStrictEqual({
        cleanupForced: false,
        exitBeforeSettlement: true,
        exitObservedAtSettlement: true,
        terminationSettledAtExit: false,
      })
    } finally {
      const targetPid =
        records.find(record => record.marker === 'report')?.pid ??
        records.find(record => record.marker === 'ready')?.pid
      if (targetPid != null && isPidAlive(targetPid)) {
        process.kill(targetPid, 'SIGKILL')
      }
    }
  }
)
