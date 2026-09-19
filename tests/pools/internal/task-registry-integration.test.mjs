import { afterEach, expect, it, vi } from 'vitest'

import { FixedThreadPool, PoolEvents } from '../../../lib/index.mjs'

const pools = []

const ready = async pool => {
  if (!pool.info.ready) {
    await new Promise(resolve => pool.emitter.once(PoolEvents.ready, resolve))
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  while (pools.length > 0) {
    const pool = pools.pop()
    if (pool.info.started) await pool.destroy()
  }
})

it('settles normal responses through TaskRegistry', async () => {
  const pool = new FixedThreadPool(
    1,
    './tests/worker-files/thread/echoWorker.mjs'
  )
  pools.push(pool)
  await ready(pool)
  const settle = vi.spyOn(pool.taskRegistry, 'settle')

  await expect(pool.execute({ value: 1 })).resolves.toStrictEqual({ value: 1 })

  expect(settle).toHaveBeenCalledOnce()
  expect(pool.taskRegistry.size).toBe(0)
})

it('settles dispatch rollback through TaskRegistry', async () => {
  const pool = new FixedThreadPool(
    1,
    './tests/worker-files/thread/echoWorker.mjs'
  )
  pools.push(pool)
  await ready(pool)
  const settle = vi.spyOn(pool.taskRegistry, 'settle')
  const dispatchError = { source: 'dispatch' }
  vi.spyOn(pool, 'sendToWorker').mockImplementationOnce(() => {
    throw dispatchError
  })

  await expect(pool.execute()).rejects.toBe(dispatchError)

  expect(settle).toHaveBeenCalledOnce()
  expect(pool.taskRegistry.size).toBe(0)
})

it('settles queued abort through TaskRegistry', async () => {
  const pool = new FixedThreadPool(
    1,
    './tests/worker-files/thread/testWorker.mjs',
    { enableTasksQueue: true, tasksQueueOptions: { concurrency: 1 } }
  )
  pools.push(pool)
  await ready(pool)
  await pool.addTaskFunction('waitForRelease', buffer => {
    const view = new Int32Array(buffer)
    Atomics.wait(view, 0, 0)
    return undefined
  })
  const settle = vi.spyOn(pool.taskRegistry, 'settle')
  const release = new Int32Array(
    new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)
  )
  const blocker = pool.execute(release.buffer, 'waitForRelease')
  const controller = new AbortController()
  const reason = { source: 'abort' }
  const aborted = pool.execute({}, undefined, controller.signal)
  const abortedTaskId = [...pool.workerNodes[0].tasksQueue][0].taskId
  controller.abort(reason)

  await expect(aborted).rejects.toBe(reason)
  Atomics.store(release, 0, 1)
  Atomics.notify(release, 0, 1)
  await blocker
  expect(
    settle.mock.calls.filter(([taskId]) => taskId === abortedTaskId)
  ).toHaveLength(1)
  expect(pool.taskRegistry.size).toBe(0)
})
