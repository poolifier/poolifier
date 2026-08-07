import { randomUUID } from 'node:crypto'
import { BroadcastChannel } from 'node:worker_threads'

import { FixedThreadPool, PoolEvents } from '../../lib/index.mjs'

const workerFile = './tests/worker-files/thread/crashRecoveryMatrixWorker.mjs'
const transactionTimeout = 5_000

class CrashRecoveryThreadPool extends FixedThreadPool {
  taskFunctionTransactionTimeout = transactionTimeout
}

export const createCrashRecoveryThreadTransport = trackPool => {
  const channels = []

  const createInbox = () => {
    const name = `crash-recovery-${randomUUID()}`
    const channel = new BroadcastChannel(name)
    channels.push(channel)
    const buffered = []
    const waiters = []
    channel.onmessage = ({ data }) => {
      const index = waiters.findIndex(waiter => waiter.predicate(data))
      if (index === -1) buffered.push(data)
      else waiters.splice(index, 1)[0].resolve(data)
    }
    return {
      name,
      post: message => channel.postMessage(message),
      take: predicate => {
        const index = buffered.findIndex(predicate)
        if (index !== -1) return Promise.resolve(buffered.splice(index, 1)[0])
        const { promise, resolve } = Promise.withResolvers()
        waiters.push({ predicate, resolve })
        return promise
      },
    }
  }

  const once = (pool, event) =>
    new Promise(resolve => pool.emitter.once(event, resolve))

  const start = async (options = {}) => {
    const inbox = createInbox()
    const { size = 1, ...poolOptions } = options
    const pool = trackPool(
      new CrashRecoveryThreadPool(size, workerFile, {
        errorHandler: () => undefined,
        ...poolOptions,
        workerOptions: {
          ...poolOptions.workerOptions,
          env: {
            ...process.env,
            ...poolOptions.workerOptions?.env,
            CRASH_RECOVERY_CHANNEL: inbox.name,
          },
        },
      })
    )
    if (!pool.info.ready) await once(pool, PoolEvents.ready)
    return { inbox, pool }
  }

  return {
    closeInboxes: () => {
      for (const channel of channels.splice(0)) channel.close()
    },
    once,
    start,
  }
}
