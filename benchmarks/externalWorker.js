const {
  isMainThread,
  parentPort
} = require('worker_threads')

if (!isMainThread) {
  for (let i = 0; i <= 1000; i++) {
    const o = {
      a: i
    }
    JSON.stringify(o)
  }
  // console.log('This is the main thread ' + isMainThread)
  parentPort.postMessage({ ok: 1 })
}
