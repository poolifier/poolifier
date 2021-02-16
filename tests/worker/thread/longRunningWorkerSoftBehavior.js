'use strict'
const { ThreadWorker } = require('../../../lib/index')

async function sleep (data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(data), 50000)
  })
}

module.exports = new ThreadWorker(sleep, {
  maxInactiveTime: 500,
  async: true
})
