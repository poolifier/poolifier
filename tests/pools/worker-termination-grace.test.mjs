import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FixedThreadPool, PoolEvents } from '../../lib/index.mjs'
import {
  createPoolCleanup,
  echoThreadWorkerPath,
} from './crash-recovery-utils.mjs'

describe('Worker termination grace behavior', () => {
  const { cleanupPools, trackPool } = createPoolCleanup()
  afterEach(cleanupPools)

  it('workerNode.terminate() resolves within grace period when worker exit never fires', {
    retry: 0,
    timeout: 15_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, echoThreadWorkerPath, {
        errorHandler: () => undefined,
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const workerNode = pool.workerNodes[0]
    const nativeOnce = workerNode.worker.once.bind(workerNode.worker)
    const onceSpy = vi
      .spyOn(workerNode.worker, 'once')
      .mockImplementation(function (event, handler) {
        if (event === 'exit') return this
        return nativeOnce(event, handler)
      })
    const terminateSpy = vi
      .spyOn(workerNode.worker, 'terminate')
      .mockImplementation(async () => await new Promise(() => undefined))
    const emitSpy = vi.spyOn(workerNode, 'emit')
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    try {
      const start = performance.now()
      await workerNode.terminate()
      const elapsed = performance.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(4500)
      expect(elapsed).toBeLessThan(6000)
      expect(emitSpy).toHaveBeenCalledWith('terminated')
      expect(pool.workerNodes.includes(workerNode)).toBe(false)
      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect(workerNode.worker.eventNames()).toStrictEqual([])
      expect(workerNode.eventNames()).toStrictEqual([])
    } finally {
      onceSpy.mockRestore()
      terminateSpy.mockRestore()
      emitSpy.mockRestore()
      clearTimeoutSpy.mockRestore()
    }
  })

  it('workerNode.terminate() fast-path skips grace timer when worker has already exited', {
    retry: 0,
    timeout: 5_000,
  }, async () => {
    const pool = trackPool(
      new FixedThreadPool(1, echoThreadWorkerPath, {
        errorHandler: () => undefined,
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const workerNode = pool.workerNodes[0]
    workerNode.exited = true
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    try {
      const start = performance.now()
      await workerNode.terminate()
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(250)
      expect(setTimeoutSpy).not.toHaveBeenCalled()
      expect(workerNode.worker.eventNames()).toStrictEqual([])
      expect(workerNode.eventNames()).toStrictEqual([])
    } finally {
      setTimeoutSpy.mockRestore()
    }
  })

  it('standalone workerNode.terminate() stays alive until the grace race settles', {
    retry: 0,
    timeout: 15_000,
  }, () => {
    // Given a standalone child whose raw worker never terminates or emits exit
    const start = performance.now()

    // When it top-level-awaits the runtime worker node termination
    const child = spawnSync(
      process.execPath,
      ['tests/pools/fixtures/worker-node-termination-child.mjs'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        killSignal: 'SIGKILL',
        timeout: 10_000,
      }
    )
    const elapsed = performance.now() - start
    const markers = child.stdout
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line))
    const settledMarkers = markers.filter(marker => marker.marker === 'settled')
    const teardownMarkers = markers.filter(
      marker => marker.marker === 'teardown'
    )

    // Then the grace timer keeps the child alive for exactly one clean settlement
    expect(child.error).toBeUndefined()
    expect(child.signal).toBeNull()
    expect(child.status).toBe(0)
    expect(child.stderr).toBe('')
    expect(markers[0]).toStrictEqual({ marker: 'started' })
    expect(settledMarkers).toHaveLength(1)
    expect(settledMarkers[0].elapsed).toBeGreaterThanOrEqual(4500)
    expect(settledMarkers[0].elapsed).toBeLessThan(7000)
    expect(settledMarkers[0].workerListenerCount).toBe(0)
    expect(settledMarkers[0].workerNodeListenerCount).toBe(0)
    expect(teardownMarkers).toHaveLength(1)
    expect(teardownMarkers[0].strategy).toBe('pool-destroy')
    expect(elapsed).toBeGreaterThanOrEqual(4500)
    expect(elapsed).toBeLessThan(7000)
  })

  it('workerNode.terminate() clears the grace timer after natural exit', {
    retry: 0,
    timeout: 5_000,
  }, async () => {
    // Given a running worker with its natural termination behavior
    const pool = trackPool(
      new FixedThreadPool(1, echoThreadWorkerPath, {
        errorHandler: () => undefined,
      })
    )
    if (!pool.info.ready) {
      await new Promise(resolve => {
        pool.emitter.once(PoolEvents.ready, resolve)
      })
    }
    const workerNode = pool.workerNodes[0]
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    try {
      const start = performance.now()

      // When the runtime worker node terminates
      await workerNode.terminate()
      const elapsed = performance.now() - start

      // Then natural exit wins quickly and all termination resources are cleaned up
      expect(elapsed).toBeLessThan(3000)
      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect(workerNode.worker.eventNames()).toStrictEqual([])
      expect(workerNode.eventNames()).toStrictEqual([])
    } finally {
      clearTimeoutSpy.mockRestore()
    }
  })
})
