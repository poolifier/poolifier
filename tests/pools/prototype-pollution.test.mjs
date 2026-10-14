import cluster from 'node:cluster'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { existsSync, rmSync } from 'node:fs'
import { createConnection, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
} from '../../lib/index.mjs'

const clusterWorker = './tests/worker-files/cluster/testWorker.cjs'
const clusterIntrospectionWorker = resolve(
  './tests/worker-files/cluster/prototypePollutionWorker.cjs'
)
const environmentPollutionKey = 'POOLIFIER_ARBITRARY_ENV_POLLUTION'
const pollutedProperties = [
  '0',
  '4',
  'cwd',
  'env',
  environmentPollutionKey,
  'execArgv',
  'fd',
  'handle',
  'maxOldGenerationSizeMb',
  'NODE_OPTIONS',
  'settings',
  'workerOptions',
]
const securityMarkers = new Set()
const threadWorker = './tests/worker-files/thread/testWorker.mjs'

const clearPrototypePollution = () => {
  for (const property of pollutedProperties) {
    Reflect.deleteProperty(Object.prototype, property)
  }
}

const polluteObjectPrototype = (property, value) => {
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Object.prototype, property, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

const createImportPayload = () => {
  const marker = join(
    tmpdir(),
    `poolifier-prototype-pollution-${process.pid.toString()}-${randomUUID()}`
  )
  securityMarkers.add(marker)
  const source = `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'executed')`
  return {
    importOption: `--import=data:text/javascript,${encodeURIComponent(source)}`,
    marker,
  }
}

const waitFor = async (predicate, timeout = 5000) => {
  const deadline = Date.now() + timeout
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for condition')
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

afterEach(() => {
  clearPrototypePollution()
  for (const marker of securityMarkers) {
    rmSync(marker, { force: true })
  }
  securityMarkers.clear()
})

describe('Worker option prototype pollution', () => {
  it('ignores inherited thread worker options', async () => {
    const { importOption, marker } = createImportPayload()
    polluteObjectPrototype('workerOptions', { execArgv: [importOption] })
    const pool = new FixedThreadPool(1, threadWorker)
    try {
      await expect(pool.execute()).resolves.toStrictEqual({ ok: 1 })
      expect(existsSync(marker)).toBe(false)
    } finally {
      clearPrototypePollution()
      await pool.destroy()
    }
  })

  it('ignores inherited properties in explicit thread worker options', async () => {
    const { importOption, marker } = createImportPayload()
    polluteObjectPrototype('execArgv', [importOption])
    const pool = new FixedThreadPool(1, threadWorker, { workerOptions: {} })
    try {
      await expect(pool.execute()).resolves.toStrictEqual({ ok: 1 })
      expect(existsSync(marker)).toBe(false)
    } finally {
      clearPrototypePollution()
      await pool.destroy()
    }
  })

  it('ignores inherited thread resource limits', async () => {
    polluteObjectPrototype('maxOldGenerationSizeMb', 'invalid')
    const pool = new FixedThreadPool(1, threadWorker, {
      workerOptions: { resourceLimits: {} },
    })
    try {
      await expect(pool.execute()).resolves.toStrictEqual({ ok: 1 })
    } finally {
      clearPrototypePollution()
      await pool.destroy()
    }
  })

  it('preserves null thread resource limits', async () => {
    const pool = new FixedThreadPool(1, threadWorker, {
      workerOptions: { resourceLimits: null },
    })
    try {
      await expect(pool.execute()).resolves.toStrictEqual({ ok: 1 })
    } finally {
      await pool.destroy()
    }
  })

  it('ignores thread worker options polluted after dynamic pool construction', async () => {
    const pool = new DynamicThreadPool(1, 2, threadWorker)
    const { importOption, marker } = createImportPayload()
    polluteObjectPrototype('workerOptions', { execArgv: [importOption] })
    try {
      await Promise.all(Array.from({ length: 4 }, () => pool.execute()))
      expect(existsSync(marker)).toBe(false)
    } finally {
      clearPrototypePollution()
      await pool.destroy()
    }
  })

  it('ignores inherited cluster worker environment options', async () => {
    const { importOption, marker } = createImportPayload()
    polluteObjectPrototype('env', { NODE_OPTIONS: importOption })
    const pool = new FixedClusterPool(1, clusterWorker)
    try {
      await expect(pool.execute()).resolves.toStrictEqual({ ok: 1 })
      expect(existsSync(marker)).toBe(false)
    } finally {
      clearPrototypePollution()
      await pool.destroy()
    }
  })

  it('ignores inherited properties in explicit cluster worker environment options', async () => {
    const { importOption, marker } = createImportPayload()
    polluteObjectPrototype('NODE_OPTIONS', importOption)
    const pool = new FixedClusterPool(1, clusterWorker, { env: {} })
    try {
      await expect(pool.execute()).resolves.toStrictEqual({ ok: 1 })
      expect(existsSync(marker)).toBe(false)
    } finally {
      clearPrototypePollution()
      await pool.destroy()
    }
  })

  it('ignores inherited cluster settings', async () => {
    const { importOption, marker } = createImportPayload()
    polluteObjectPrototype('settings', { execArgv: [importOption] })
    const pool = new FixedClusterPool(1, clusterWorker)
    try {
      await expect(pool.execute()).resolves.toStrictEqual({ ok: 1 })
      expect(existsSync(marker)).toBe(false)
    } finally {
      clearPrototypePollution()
      await pool.destroy()
    }
  })

  it('ignores inherited properties in explicit cluster settings', async () => {
    const { importOption, marker } = createImportPayload()
    polluteObjectPrototype('execArgv', [importOption])
    const pool = new FixedClusterPool(1, clusterWorker, { settings: {} })
    try {
      await expect(pool.execute()).resolves.toStrictEqual({ ok: 1 })
      expect(existsSync(marker)).toBe(false)
    } finally {
      clearPrototypePollution()
      await pool.destroy()
    }
  })

  it('ignores cluster worker environment options polluted before replacement', async () => {
    const pool = new FixedClusterPool(1, clusterWorker)
    await pool.execute()
    const workerId = pool.workerNodes[0].info.id
    const { importOption, marker } = createImportPayload()
    polluteObjectPrototype('env', { NODE_OPTIONS: importOption })
    try {
      await pool.destroyWorkerNode(0)
      await waitFor(
        () =>
          pool.workerNodes[0]?.info.ready === true &&
          pool.workerNodes[0]?.info.id !== workerId
      )
      await expect(pool.execute()).resolves.toStrictEqual({ ok: 1 })
      expect(existsSync(marker)).toBe(false)
    } finally {
      clearPrototypePollution()
      await pool.destroy()
    }
  })

  it('shadows arbitrary inherited cluster worker environment keys', async () => {
    polluteObjectPrototype(environmentPollutionKey, 'polluted')
    const pool = new FixedClusterPool(1, clusterIntrospectionWorker)
    try {
      await expect(
        pool.execute({ envKey: environmentPollutionKey })
      ).resolves.toMatchObject({ hasEnvKey: false })
    } finally {
      clearPrototypePollution()
      await pool.destroy()
    }
  })

  it('shadows inherited cwd for initial and replacement cluster workers', async () => {
    polluteObjectPrototype('cwd', tmpdir())
    const pool = new FixedClusterPool(1, clusterIntrospectionWorker)
    try {
      await expect(pool.execute()).resolves.toMatchObject({
        cwd: process.cwd(),
      })
      const workerId = pool.workerNodes[0].info.id
      await pool.destroyWorkerNode(0)
      await waitFor(
        () =>
          pool.workerNodes[0]?.info.ready === true &&
          pool.workerNodes[0]?.info.id !== workerId
      )
      await expect(pool.execute()).resolves.toMatchObject({
        cwd: process.cwd(),
      })
    } finally {
      clearPrototypePollution()
      await pool.destroy()
    }
  })

  it('materializes deleted stdio slots before cluster replacement', async () => {
    const stdio = ['ignore', 'ignore', 'ignore', 'ipc', undefined]
    const pool = new FixedClusterPool(1, clusterWorker, {
      settings: { stdio },
    })
    try {
      await expect(pool.execute()).resolves.toStrictEqual({ ok: 1 })
      const workerId = pool.workerNodes[0].info.id
      Reflect.deleteProperty(cluster.settings.stdio, 4)
      polluteObjectPrototype('4', 'ipc')
      await pool.destroyWorkerNode(0)
      await waitFor(
        () =>
          pool.workerNodes[0]?.info.ready === true &&
          pool.workerNodes[0]?.info.id !== workerId
      )
      expect(Object.hasOwn(cluster.settings.stdio, 4)).toBe(true)
      expect(cluster.settings.stdio[4]).toBeUndefined()
      await expect(pool.execute()).resolves.toStrictEqual({ ok: 1 })
    } finally {
      clearPrototypePollution()
      await pool.destroy()
    }
  })

  it('rejects late Object.prototype stdio controls at cluster launch', async () => {
    const server = createServer()
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const connectionPromise = once(server, 'connection')
    const clientSocket = createConnection(server.address().port, '127.0.0.1')
    await once(clientSocket, 'connect')
    const [serverSocket] = await connectionPromise
    const clientSocketClosed = once(clientSocket, 'close')
    const serverSocketClosed = once(serverSocket, 'close')
    const previousStdio = cluster.settings.stdio
    const pool = new FixedClusterPool(1, clusterWorker, {
      settings: {
        stdio: ['ignore', clientSocket, 'ignore', 'ipc'],
      },
      startWorkers: false,
    })
    polluteObjectPrototype('fd', -1)
    try {
      expect(() => pool.start()).toThrow(
        new TypeError(
          "Invalid cluster.settings.stdio entry: inherited 'fd' from Object.prototype is not allowed"
        )
      )
      clearPrototypePollution()
      polluteObjectPrototype('handle', clientSocket._handle)
      expect(() => pool.start()).toThrow(
        new TypeError(
          "Invalid cluster.settings.stdio entry: inherited 'handle' from Object.prototype is not allowed"
        )
      )
      clearPrototypePollution()
      if (process.platform === 'win32') {
        // Node.js cannot pass a connected TCP socket as child process stdio on
        // Windows. The socket is only needed to exercise native handle checks.
        cluster.setupPrimary({ stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
      }
      polluteObjectPrototype('handle', 'polluted')
      pool.start()
      clearPrototypePollution()
      await expect(pool.execute()).resolves.toStrictEqual({ ok: 1 })
    } finally {
      clearPrototypePollution()
      if (pool.info.started) {
        await pool.destroy()
      }
      cluster.setupPrimary({ stdio: previousStdio })
      clientSocket.destroy()
      serverSocket.destroy()
      await Promise.all([clientSocketClosed, serverSocketClosed])
      await new Promise((resolve, reject) => {
        server.close(error => {
          if (error != null) {
            reject(error)
            return
          }
          resolve()
        })
      })
    }
  })

  it('rejects sparse thread worker execArgv before reading inherited slots', () => {
    const { importOption, marker } = createImportPayload()
    polluteObjectPrototype('0', importOption)
    expect(
      () =>
        new FixedThreadPool(1, threadWorker, {
          workerOptions: { execArgv: new Array(1) },
        })
    ).toThrow(
      new TypeError(
        'Invalid workerOptions.execArgv: must not be a sparse array'
      )
    )
    expect(existsSync(marker)).toBe(false)
  })

  it('rejects sparse cluster execArgv before reading inherited slots', () => {
    const { importOption, marker } = createImportPayload()
    polluteObjectPrototype('0', importOption)
    expect(
      () =>
        new FixedClusterPool(1, clusterWorker, {
          settings: { execArgv: new Array(1) },
        })
    ).toThrow(
      new TypeError('Invalid settings.execArgv: must not be a sparse array')
    )
    expect(existsSync(marker)).toBe(false)
  })

  it.runIf(process.platform === 'win32')(
    'preserves worker precedence across the Windows cluster environment merge',
    async () => {
      const { importOption, marker } = createImportPayload()
      const nodeOptionsEntries = Object.entries(process.env).filter(
        ([key]) => key.toUpperCase() === 'NODE_OPTIONS'
      )
      for (const [key] of nodeOptionsEntries) {
        Reflect.deleteProperty(process.env, key)
      }
      process.env.NODE_OPTIONS = importOption
      let pool
      try {
        pool = new FixedClusterPool(1, clusterIntrospectionWorker, {
          env: { node_options: '--no-warnings' },
        })
        await expect(
          pool.execute({ envKey: 'NODE_OPTIONS' })
        ).resolves.toMatchObject({
          envValue: '--no-warnings',
          hasEnvKey: true,
        })
        expect(existsSync(marker)).toBe(false)
      } finally {
        for (const key of Object.keys(process.env)) {
          if (key.toUpperCase() === 'NODE_OPTIONS') {
            Reflect.deleteProperty(process.env, key)
          }
        }
        for (const [key, value] of nodeOptionsEntries) {
          process.env[key] = value
        }
        if (pool != null) {
          await pool.destroy()
        }
      }
    }
  )
})
