import { describe, expect, it } from 'vitest'

import { DynamicClusterPool, FixedClusterPool } from '../../../lib/index.mjs'

const bounded = async promise => {
  let timeout
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Cluster worker operation remained pending')),
          5000
        )
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}

// Start destruction before force-killing on failure, so fixed workers cannot restart.
const destroyPool = async pool => {
  const workers = pool.workerNodes.map(workerNode => workerNode.worker)
  const exits = workers.map(worker => {
    return worker.isDead()
      ? Promise.resolve()
      : new Promise(resolve => worker.once('exit', resolve))
  })
  try {
    await bounded(pool.destroy())
    expect(workers.every(worker => worker.isDead())).toBe(true)
  } finally {
    for (const worker of workers) {
      if (!worker.isDead()) worker.process.kill('SIGKILL')
    }
    await bounded(Promise.all(exits))
  }
  expect(workers).toHaveLength(1)
  expect(pool.info.started).toBe(false)
}

for (const [poolType, PoolClass, sizes] of [
  ['fixed', FixedClusterPool, [1]],
  ['dynamic', DynamicClusterPool, [0, 1]],
]) {
  describe(`${poolType} cluster worker module formats`, { retry: 0 }, () => {
    for (const [format, workerFile] of [
      ['ESM', './tests/worker-files/cluster/echoWorker.mjs'],
      ['CommonJS', './tests/worker-files/cluster/echoWorker.cjs'],
    ]) {
      it(`executes an immediate task with ${format} and destroys the worker`, async () => {
        const pool = new PoolClass(...sizes, workerFile, {
          restartWorkerOnError: false,
        })
        const data = {
          format,
          nested: { enabled: true, values: [1, 'two', null] },
          poolType,
        }
        try {
          // Do not wait for online or ready: the first startup message must survive ESM loading.
          expect(await bounded(pool.execute(data))).toStrictEqual(data)
        } finally {
          await destroyPool(pool)
        }
      }, 20000)
    }
  })
}
