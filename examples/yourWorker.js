'use strict'
const { ThreadWorker } = require('poolifier')
const { isMainThread } = require('worker_threads')

const debug = false

function yourFunction (data) {
  for (let i = 0; i <= 1000; i++) {
    const o = {
      a: i
    }
    JSON.stringify(o)
  }
  debug === true && console.log('This is the main thread ' + isMainThread)
  return { ok: 1 }
}

module.exports = new ThreadWorker(yourFunction)
