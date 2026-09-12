import { expect } from 'vitest'

import { PoolEvents, WorkerCrashError } from '../../lib/index.mjs'

const once = (pool, event) =>
  new Promise(resolve => pool.emitter.once(event, resolve))

export const verifyBusyStateAfterCrash = async start => {
  const { inbox, pool } = await start()
  const busyEvents = []
  const busyEndEvents = []
  pool.emitter.on(PoolEvents.busy, info => busyEvents.push(info))
  pool.emitter.on(PoolEvents.busyEnd, info => busyEndEvents.push(info))
  const replacement = once(pool, PoolEvents.ready)
  const crash = pool.execute({ action: 'wait-crash', token: 'busy-crash' })
  const dispatch = await inbox.take(message => message.token === 'busy-crash')

  inbox.post({ action: 'crash-task', target: dispatch.id })

  await expect(crash).rejects.toBeInstanceOf(WorkerCrashError)
  await replacement
  expect(busyEvents).toHaveLength(1)
  expect(busyEndEvents).toHaveLength(1)

  const nextBusyEnd = once(pool, PoolEvents.busyEnd)
  await expect(pool.execute({ action: 'echo' })).resolves.toMatchObject({
    action: 'echo',
  })
  await nextBusyEnd
  expect(busyEvents).toHaveLength(2)
  expect(busyEndEvents).toHaveLength(2)

  await pool.destroy()
  const restarted = once(pool, PoolEvents.ready)
  pool.start()
  await restarted
  const restartedBusyEnd = once(pool, PoolEvents.busyEnd)
  await expect(pool.execute({ action: 'echo' })).resolves.toMatchObject({
    action: 'echo',
  })
  await restartedBusyEnd
  expect(busyEvents).toHaveLength(3)
  expect(busyEndEvents).toHaveLength(3)
}
