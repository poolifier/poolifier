import cluster from 'node:cluster'
import { fileURLToPath } from 'node:url'

import { terminateWorker } from '../../../lib/pools/worker-termination.mjs'
import { WorkerTypes } from '../../../lib/pools/worker.mjs'

if (cluster.isWorker) {
  process.on('SIGTERM', () => undefined)
  const keepAlive = setInterval(() => undefined, 60_000)
  keepAlive.ref()
  process.send({ marker: 'ready', pid: process.pid })
} else {
  const writeRecord = record => {
    process.stdout.write(`${JSON.stringify(record)}\n`)
  }
  cluster.setupPrimary({ exec: fileURLToPath(import.meta.url) })
  const target = cluster.fork()
  const targetExit = Promise.withResolvers()
  const targetReady = new Promise(resolve => {
    target.once('message', resolve)
  })
  let cleanupForced = false
  let exitBeforeSettlement = false
  let exitCode
  let exitObserved = false
  let exitSignal
  let terminationSettled = false

  target.once('exit', (code, signal) => {
    exitCode = code
    exitBeforeSettlement = !terminationSettled
    exitObserved = true
    exitSignal = signal
    writeRecord({
      code,
      marker: 'exit',
      signal,
      terminationSettled,
    })
    targetExit.resolve()
  })

  const bounded = async (promise, timeout, label) => {
    const signal = AbortSignal.timeout(timeout)
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            reject(new Error(`${label} timed out after ${timeout}ms`))
          },
          { once: true }
        )
      }),
    ])
  }

  try {
    const ready = await bounded(targetReady, 1000, 'target readiness')
    writeRecord(ready)
    const terminationOutcome = await bounded(
      terminateWorker(target, WorkerTypes.cluster, false).then(
        () => ({ status: 'fulfilled' }),
        error => ({
          error: { message: error?.message, name: error?.name },
          status: 'rejected',
        })
      ),
      11_000,
      'cluster termination'
    )
    terminationSettled = true
    writeRecord({
      exitObserved,
      marker: 'settled',
      ...terminationOutcome,
    })
  } finally {
    if (!exitObserved) {
      cleanupForced = true
      target.kill('SIGKILL')
      await bounded(targetExit.promise, 1000, 'forced cleanup')
    }
    writeRecord({
      cleanupForced,
      exitBeforeSettlement,
      exitCode,
      exitSignal,
      marker: 'report',
      pid: target.process.pid,
    })
  }
}
