// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { createHook, executionAsyncId } from 'node:async_hooks'
import { EventEmitterAsyncResource, getEventListeners } from 'node:events'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CircularBuffer } from '../../lib/circular-buffer.mjs'
import {
  DynamicClusterPool,
  DynamicThreadPool,
  FixedClusterPool,
  FixedThreadPool,
  PoolEvents,
  PoolTypes,
  WorkerChoiceStrategies,
  WorkerTerminationError,
  WorkerTypes,
} from '../../lib/index.mjs'
import { WorkerNode } from '../../lib/pools/worker-node.mjs'
import { PriorityQueue } from '../../lib/queues/priority-queue.mjs'
import { defaultBucketSize } from '../../lib/queues/queue-types.mjs'
import { DEFAULT_TASK_NAME } from '../../lib/utils.mjs'
import { waitPoolEvents } from '../test-utils.cjs'

export { describe, expect, it, vi } from 'vitest'
export {
  CircularBuffer,
  createHook,
  DEFAULT_TASK_NAME,
  defaultBucketSize,
  DynamicClusterPool,
  DynamicThreadPool,
  EventEmitterAsyncResource,
  executionAsyncId,
  FixedClusterPool,
  FixedThreadPool,
  getEventListeners,
  PoolEvents,
  PoolTypes,
  PriorityQueue,
  waitPoolEvents,
  WorkerChoiceStrategies,
  WorkerNode,
  WorkerTerminationError,
  WorkerTypes,
}

export const version = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../..', 'package.json'),
    'utf8'
  )
).version
export const numberOfWorkers = 2
export class StubPoolWithIsMain extends FixedThreadPool {
  isMain () {
    return false
  }
}
export const ready = async pool => {
  if (!pool.info.ready) {
    await new Promise(resolve => pool.emitter.once(PoolEvents.ready, resolve))
  }
}
export const nativeQueueMicrotask = globalThis.queueMicrotask.bind(globalThis)
