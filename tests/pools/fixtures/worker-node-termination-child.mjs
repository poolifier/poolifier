import { FixedThreadPool, PoolEvents } from '../../../lib/index.mjs'

const pool = new FixedThreadPool(
  1,
  './tests/worker-files/thread/echoWorker.mjs',
  { errorHandler: () => undefined }
)
if (!pool.info.ready) {
  await new Promise(resolve => {
    pool.emitter.once(PoolEvents.ready, resolve)
  })
}

const workerNode = pool.workerNodes[0]
const nativeOnce = workerNode.worker.once.bind(workerNode.worker)
workerNode.worker.once = function (event, handler) {
  if (event === 'exit') return this
  return nativeOnce(event, handler)
}
workerNode.worker.terminate = async () => await new Promise(() => undefined)

const start = performance.now()
console.log(JSON.stringify({ marker: 'started' }))
await workerNode.terminate()
console.log(
  JSON.stringify({
    elapsed: performance.now() - start,
    marker: 'settled',
    workerListenerCount: workerNode.worker.eventNames().length,
    workerNodeListenerCount: workerNode.eventNames().length,
  })
)
workerNode.worker.unref()
await pool.destroy()
await new Promise(resolve => {
  process.stdout.write(
    `${JSON.stringify({ marker: 'teardown', strategy: 'pool-destroy' })}\n`,
    resolve
  )
})
