'use strict'
const { ThreadWorker } = require('../../lib/index')

function echo (data) {
  return data
}

module.exports = new ThreadWorker(echo, { maxInactiveTime: 500 })
