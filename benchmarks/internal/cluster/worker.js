'use strict'
const { ClusterWorker } = require('../../../lib/index')

function yourFunction (data) {
  for (let i = 0; i < 1000; i++) {
    const o = {
      a: i
    }
    JSON.stringify(o)
  }
  // console.log('This is the main thread ' + isMaster)
  return { ok: 1 }
}

module.exports = new ClusterWorker(yourFunction)
