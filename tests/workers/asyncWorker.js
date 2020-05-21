'use strict'
const { ThreadWorker } = require('../../lib/workers')

async function sleep (data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(data), 2000)
  })
}

module.exports = new ThreadWorker(sleep, { maxInactiveTime: 500, async: true })