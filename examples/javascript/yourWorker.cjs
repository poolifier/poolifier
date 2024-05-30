'use strict'
const { ThreadWorker } = require('poolifier')

/**
 *
 */
function yourFunction () {
  for (let i = 0; i <= 1000; i++) {
    const o = {
      a: i,
    }
    JSON.stringify(o)
  }
  return { ok: 1 }
}

module.exports = new ThreadWorker(yourFunction)
