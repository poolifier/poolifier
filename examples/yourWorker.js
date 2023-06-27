'use strict'
const { isMainThread } = require('worker_threads')
const { ThreadWorker } = require('poolifier')

const debug = false

function yourFunction () {
  for (let i = 0; i <= 1000; i++) {
    const o = {
      a: i
    }
    JSON.stringify(o)
  }
  debug === true && console.info('This is the main thread ' + isMainThread)
  return { ok: 1 }
}

module.exports = new ThreadWorker(yourFunction)
